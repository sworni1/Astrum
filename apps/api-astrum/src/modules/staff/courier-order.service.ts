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
  issueDeliveredLines,
  isCancellable,
  logWriteRefusal,
  resolveCancelPayment,
  sumOfLines,
} from "./staff-order.helpers";

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

export type CourierVerdict =
  | "notFound"
  | "alreadyHandedOver"
  | "claimedByCaller"
  | "claimedByAnother"
  | "notDelivered"
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
  if (order === null || order.shippingMethod.isPickup) {
    return "notFound";
  }

  if (order.handedOverAt !== null) {
    return "alreadyHandedOver";
  }

  if (order.courierUserId === userId) {
    return order.status === "DELIVERED" ? "claimedByCaller" : "notDelivered";
  }

  if (order.courierUserId !== null) {
    return "claimedByAnother";
  }

  return order.status === "DELIVERED" ? "free" : "notDelivered";
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

const orderNotDelivered = () =>
  new AppError(
    409,
    STAFF_ERROR_CODES.orderNotDelivered,
    "This order is not delivered yet.",
  );

const nothingToCancel = () =>
  new AppError(
    409,
    STAFF_ERROR_CODES.nothingToCancel,
    "No line of this order can be cancelled.",
  );

const collectsAtTheDoor = (method: PaymentMethod): boolean =>
  method === "CASH" || method === "CARD_ON_DELIVERY";

export class CourierOrderService {
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
      status: "DELIVERED" as const,
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
        return { order: toCourierOrderJson(row, userId), wrote: false };
      }

      if (verdict === "alreadyHandedOver") {
        throw alreadyHandedOver();
      }

      if (verdict === "claimedByAnother") {
        throw alreadyClaimed();
      }

      if (verdict === "notDelivered") {
        throw orderNotDelivered();
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

      if (verdict === "notDelivered" && row.courierUserId === userId) {
        throw orderNotDelivered();
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

  async handOver(
    orderId: string,
    userId: string,
  ): Promise<{ order: CourierOrderJson }> {
    try {
      const { order, issuedLineCount, collected } =
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

          if (row.courierUserId !== userId) {
            throw orderNotFound();
          }

          if (row.status !== "DELIVERED") {
            throw orderNotDelivered();
          }

          const timestamp = new Date();
          const issued = await issueDeliveredLines(tx, row.OrderItem);
          const paid =
            collectsAtTheDoor(row.paymentMethod) &&
            row.paymentStatus === "PENDING" &&
            issued > 0;
          const status = await recomputeOrderStatus(
            tx,
            orderId,
            paid ? "PAID" : undefined,
          );

          if (status === "ISSUED") {
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
            issuedLineCount: issued,
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
        issuedLineCount,
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

  async cancelOrder(
    orderId: string,
    userId: string,
  ): Promise<{ order: CourierOrderJson }> {
    try {
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

          const cancellable = row.OrderItem.filter(isCancellable);

          if (cancellable.length === 0) {
            throw nothingToCancel();
          }

          if (row.status !== "DELIVERED") {
            throw orderNotDelivered();
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
