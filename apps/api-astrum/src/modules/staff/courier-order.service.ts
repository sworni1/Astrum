import type { OrderItem } from "@astrum/db/client";
import type { Prisma } from "@astrum/db/client";
import type {
  Currency,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@astrum/db/enums";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import { logger } from "../../common/helpers/logger";
import { toMoney } from "../../common/helpers/money";
import { parsePagination } from "../../common/helpers/pagination";
import { ORDER_ERROR_CODES } from "../order/constants/order.constants";
import { invalidateStockOfProducts } from "../order/order-cache";
import {
  lockOrder,
  ORDER_TRANSACTION_OPTIONS,
  recomputeOrderStatus,
} from "../order/order-status.helpers";
import { expireSessionForCancel } from "../payment/payment.cancel";
import { STAFF_ERROR_CODES } from "./constants/staff.constants";
import {
  cancelOrderLines,
  deliverShippedLines,
  isCancellable,
  logWriteRefusal,
  resolveCancelPayment,
  sumOfLines,
} from "./staff-order.helpers";

/** The two lists one courier reads: his own parcels, and the pool (AC-2). */
export type CourierScope = "mine" | "available";

type CourierOrderLine = Pick<
  OrderItem,
  | "id"
  | "name"
  | "previewImage"
  | "quantity"
  | "price"
  | "currency"
  | "status"
>;

type CourierOrderRow = {
  id: string;
  createdAt: Date;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  handedOverAt: Date | null;
  grandTotal: Prisma.Decimal;
  currency: Currency;
  courierUserId: string | null;
  deliveryDate: Date;
  deliveryAddress: string | null;
  OrderItem: CourierOrderLine[];
};

const COURIER_ORDER_LINE_SELECT = {
  id: true,
  name: true,
  previewImage: true,
  quantity: true,
  price: true,
  currency: true,
  status: true,
} as const;

/**
 * The courier's card: the parcel and, on a row he claimed, its address. No buyer
 * identity, no point, no shipping method beyond the ownership proof (AC-3).
 */
const COURIER_ORDER_SELECT = {
  id: true,
  createdAt: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  handedOverAt: true,
  grandTotal: true,
  currency: true,
  courierUserId: true,
  deliveryDate: true,
  deliveryAddress: true,
  shippingMethod: { select: { isPickup: true } },
  OrderItem: {
    orderBy: { id: "asc" },
    select: COURIER_ORDER_LINE_SELECT,
  },
} as const;

/** The cancel returns stock and names the buyer, so it reads both privately (AC-8). */
const COURIER_CANCEL_SELECT = {
  ...COURIER_ORDER_SELECT,
  userId: true,
  OrderItem: {
    orderBy: { id: "asc" },
    select: { ...COURIER_ORDER_LINE_SELECT, productId: true },
  },
} as const;

export const toCourierOrderJson = (
  row: CourierOrderRow,
  viewerId: string,
) => ({
  id: row.id,
  createdAt: row.createdAt,
  status: row.status,
  paymentStatus: row.paymentStatus,
  paymentMethod: row.paymentMethod,
  handedOverAt: row.handedOverAt,
  grandTotal: toMoney(row.grandTotal),
  currency: row.currency,
  courierUserId: row.courierUserId,
  deliveryDate: row.deliveryDate,
  // The claim is what buys the address: a pool row and a released row carry none.
  deliveryAddress:
    row.courierUserId === viewerId ? row.deliveryAddress : null,
  orderItems: row.OrderItem.map((line) => ({
    id: line.id,
    name: line.name,
    previewImage: line.previewImage,
    quantity: line.quantity,
    price: toMoney(line.price),
    currency: line.currency,
    status: line.status,
  })),
});

export type CourierOrderJson = ReturnType<typeof toCourierOrderJson>;

export type CourierOrdersPage = {
  orders: CourierOrderJson[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/**
 * Everything one write needs to know about the parcel, in one place, so the four
 * writes cannot drift apart on who may touch what (AC-4 to AC-8).
 */
export type CourierVerdict =
  | "notFound"
  | "alreadyHandedOver"
  | "claimedByCaller"
  | "claimedByAnother"
  | "notShipped"
  | "free";

type ClassifiableOrder = {
  status: OrderStatus;
  handedOverAt: Date | null;
  courierUserId: string | null;
  shippingMethod: { isPickup: boolean };
};

const classifyCourierOrder = (
  order: ClassifiableOrder | null,
  userId: string,
): CourierVerdict => {
  // A counter parcel answers like a missing one, so a courier never learns it
  // exists (AC-4).
  if (order === null || order.shippingMethod.isPickup) {
    return "notFound";
  }

  if (order.handedOverAt !== null) {
    return "alreadyHandedOver";
  }

  if (order.courierUserId === userId) {
    return order.status === "SHIPPED" ? "claimedByCaller" : "notShipped";
  }

  if (order.courierUserId !== null) {
    return "claimedByAnother";
  }

  return order.status === "SHIPPED" ? "free" : "notShipped";
};

const invalidPagination = () =>
  new AppError(422, STAFF_ERROR_CODES.validation, "Invalid pagination.");

const orderNotFound = () =>
  new AppError(404, ORDER_ERROR_CODES.notFound, "Order not found.");

const alreadyHandedOver = () =>
  new AppError(
    409,
    STAFF_ERROR_CODES.alreadyHandedOver,
    "This order was already handed over.",
  );

const alreadyClaimed = () =>
  new AppError(
    409,
    STAFF_ERROR_CODES.alreadyClaimed,
    "Another courier took this parcel.",
  );

const orderNotShipped = () =>
  new AppError(
    409,
    STAFF_ERROR_CODES.orderNotShipped,
    "This order is not marked as sent yet.",
  );

const nothingToCancel = () =>
  new AppError(
    409,
    STAFF_ERROR_CODES.nothingToCancel,
    "No line of this order can be cancelled.",
  );

/** The two methods that collect money at the door (AC-7). */
const collectsAtTheDoor = (method: PaymentMethod): boolean =>
  method === "CASH" || method === "CARD_ON_DELIVERY";

/**
 * The courier's pool, his claims and the four writes that close a parcel. Every
 * write runs one transaction under the order lock and reads the parcel through
 * one classification, so two couriers pressing at once cannot both win (AC-2 to
 * AC-8).
 */
export class CourierOrderService {
  /** One page of one of the two lists, oldest first (AC-2, AC-3). */
  async listCourierOrders(
    userId: string,
    scope: CourierScope,
    pageInput?: unknown,
    limitInput?: unknown,
  ): Promise<CourierOrdersPage> {
    const { page, limit } = parsePagination(
      pageInput,
      limitInput,
      invalidPagination,
    );
    const where = {
      status: "SHIPPED" as const,
      shippingMethod: { isPickup: false },
      courierUserId: scope === "mine" ? userId : null,
    };
    const total = await prisma.order.count({ where });
    const orders = await prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: COURIER_ORDER_SELECT,
    });

    return {
      orders: orders.map((order) => toCourierOrderJson(order, userId)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** One press takes a parcel out of the pool; a second press writes nothing (AC-4). */
  async claim(
    orderId: string,
    userId: string,
  ): Promise<{ order: CourierOrderJson }> {
    const { order, wrote } = await prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);

      const row = await tx.order.findUnique({
        where: { id: orderId },
        select: COURIER_ORDER_SELECT,
      });
      const verdict = classifyCourierOrder(row, userId);

      if (row === null || verdict === "notFound") {
        throw orderNotFound();
      }

      if (verdict === "claimedByCaller") {
        // A second press answers the same row and writes nothing, not even a log
        // line (AC-4).
        return { order: toCourierOrderJson(row, userId), wrote: false };
      }

      if (verdict === "alreadyHandedOver") {
        throw alreadyHandedOver();
      }

      if (verdict === "claimedByAnother") {
        throw alreadyClaimed();
      }

      if (verdict === "notShipped") {
        throw orderNotShipped();
      }

      await tx.order.update({
        where: { id: orderId },
        data: { courierUserId: userId },
      });

      return {
        order: toCourierOrderJson({ ...row, courierUserId: userId }, userId),
        wrote: true,
      };
    }, ORDER_TRANSACTION_OPTIONS);

    if (wrote) {
      logger.info({
        event: "staff.courier.claimed",
        userId,
        orderId,
        resultCode: "OK",
      });
    }

    return { order };
  }

  /** Gives a parcel back to the pool; a press on something the caller does not hold writes nothing (AC-5). */
  async release(
    orderId: string,
    userId: string,
  ): Promise<{ order: CourierOrderJson }> {
    const order = await prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);

      const row = await tx.order.findUnique({
        where: { id: orderId },
        select: COURIER_ORDER_SELECT,
      });
      const verdict = classifyCourierOrder(row, userId);

      if (row === null || verdict === "notFound") {
        throw orderNotFound();
      }

      if (verdict === "alreadyHandedOver") {
        throw alreadyHandedOver();
      }

      if (verdict === "claimedByCaller") {
        await tx.order.update({
          where: { id: orderId },
          data: { courierUserId: null },
        });

        return toCourierOrderJson({ ...row, courierUserId: null }, userId);
      }

      // A release of something the caller does not hold has nothing to say about
      // who holds it (AC-5).
      if (verdict === "notShipped" && row.courierUserId === userId) {
        throw orderNotShipped();
      }

      throw orderNotFound();
    }, ORDER_TRANSACTION_OPTIONS);

    logger.info({
      event: "staff.courier.released",
      userId,
      orderId,
      resultCode: "OK",
    });

    return { order };
  }

  /** The parcel is closed at the door: every shipped line is delivered, and the money is recorded (AC-6, AC-7). */
  async handOver(
    orderId: string,
    userId: string,
  ): Promise<{ order: CourierOrderJson }> {
    try {
      const { order, deliveredLineCount, collected } =
        await prisma.$transaction(async (tx) => {
          await lockOrder(tx, orderId);

          const row = await tx.order.findUnique({
            where: { id: orderId },
            select: COURIER_ORDER_SELECT,
          });
          const verdict = classifyCourierOrder(row, userId);

          if (row === null || verdict === "notFound") {
            throw orderNotFound();
          }

          if (verdict === "alreadyHandedOver") {
            throw alreadyHandedOver();
          }

          // An unclaimed or a foreign parcel is not the caller's to close (AC-6).
          if (row.courierUserId !== userId) {
            throw orderNotFound();
          }

          if (row.status !== "SHIPPED") {
            throw orderNotShipped();
          }

          const timestamp = new Date();
          const delivered = await deliverShippedLines(
            tx,
            row.OrderItem,
            timestamp,
          );
          const paid =
            collectsAtTheDoor(row.paymentMethod) &&
            row.paymentStatus === "PENDING" &&
            delivered > 0;
          const status = await recomputeOrderStatus(
            tx,
            orderId,
            paid ? "PAID" : undefined,
          );

          if (status === "DELIVERED") {
            await tx.order.updateMany({
              where: { id: orderId, handedOverAt: null },
              data: { handedOverAt: timestamp },
            });
          }

          const answered = await tx.order.findUniqueOrThrow({
            where: { id: orderId },
            select: COURIER_ORDER_SELECT,
          });

          return {
            order: toCourierOrderJson(answered, userId),
            deliveredLineCount: delivered,
            collected: paid
              ? {
                  amount: row.grandTotal.toFixed(2),
                  currency: row.currency,
                }
              : null,
          };
        }, ORDER_TRANSACTION_OPTIONS);

      logger.info({
        event: "staff.courier.handed_over",
        userId,
        orderId,
        deliveredLineCount,
        resultCode: "OK",
        ...(collected
          ? {
              collectedAmount: collected.amount,
              collectedCurrency: collected.currency,
            }
          : {}),
      });

      return { order };
    } catch (error) {
      logWriteRefusal(
        "staff.courier.handover_refused",
        { userId, orderId },
        error,
      );
      throw error;
    }
  }

  /** The buyer refuses at the door: every line still inside is cancelled and its stock returns (AC-8). */
  async cancelOrder(
    orderId: string,
    userId: string,
  ): Promise<{ order: CourierOrderJson }> {
    try {
      // The provider call goes before the transaction, never while the order row
      // is locked, and it only runs for the caller's own parcel (AC-8).
      await this.assertHeldOrder(orderId, userId);
      await expireSessionForCancel(orderId);

      const { order, cancelledLineCount, cancelledProductIds } =
        await prisma.$transaction(async (tx) => {
          await lockOrder(tx, orderId);

          const row = await tx.order.findUnique({
            where: { id: orderId },
            select: COURIER_CANCEL_SELECT,
          });

          if (
            row === null ||
            row.shippingMethod.isPickup ||
            row.courierUserId !== userId
          ) {
            throw orderNotFound();
          }

          // Read under the lock, never from the request: a second press finds
          // nothing left to cancel (AC-8).
          const cancellable = row.OrderItem.filter(isCancellable);

          if (cancellable.length === 0) {
            throw nothingToCancel();
          }

          if (row.status !== "SHIPPED") {
            throw orderNotShipped();
          }

          const amount = sumOfLines(cancellable);
          await cancelOrderLines(tx, cancellable);
          await recomputeOrderStatus(tx, orderId);

          await resolveCancelPayment({
            tx,
            orderId,
            paymentStatus: row.paymentStatus,
            reason: "courier_cancel",
            actorUserId: userId,
            buyerUserId: row.userId,
            amount,
            currency: row.currency,
            cancelledLineCount: cancellable.length,
          });

          const answered = await tx.order.findUniqueOrThrow({
            where: { id: orderId },
            select: COURIER_ORDER_SELECT,
          });

          return {
            order: toCourierOrderJson(answered, userId),
            cancelledLineCount: cancellable.length,
            cancelledProductIds: cancellable.map((line) => line.productId),
          };
        }, ORDER_TRANSACTION_OPTIONS);

      // The courier's cancel returns stock, so the next read must see it (AC-7 b).
      await invalidateStockOfProducts(cancelledProductIds);

      logger.info({
        event: "staff.courier.cancelled",
        userId,
        orderId,
        cancelledLineCount,
        resultCode: "OK",
      });

      return { order };
    } catch (error) {
      logWriteRefusal(
        "staff.courier.cancel_refused",
        { userId, orderId },
        error,
      );
      throw error;
    }
  }

  /** The parcel the caller claimed, read before the transaction so the provider call runs unlocked (AC-8). */
  private async assertHeldOrder(orderId: string, userId: string): Promise<void> {
    const held = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        courierUserId: true,
        shippingMethod: { select: { isPickup: true } },
      },
    });

    if (
      held === null ||
      held.shippingMethod.isPickup ||
      held.courierUserId !== userId
    ) {
      throw orderNotFound();
    }
  }
}
