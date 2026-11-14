import type { OrderItem } from "../../../generated/prisma/client";
import { Prisma } from "../../../generated/prisma/client";
import type {
  OrderItemStatus,
  PaymentMethod,
  PaymentStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import { logger } from "../../common/helpers/logger";
import { ORDER_ERROR_CODES } from "./constants/order.constants";
import {
  lockOrder,
  ORDER_TRANSACTION_OPTIONS,
  recomputeOrderStatus,
  returnOrderStock,
} from "./order-status.helpers";

type SellerOrderLine = Pick<
  OrderItem,
  | "id"
  | "productId"
  | "name"
  | "previewImage"
  | "quantity"
  | "price"
  | "currency"
  | "status"
>;

type SellerOrderItemResult = SellerOrderLine & { orderId: string };

const SELLER_ORDER_ITEM_SELECT = {
  id: true,
  orderId: true,
  productId: true,
  name: true,
  previewImage: true,
  quantity: true,
  price: true,
  currency: true,
  status: true,
} as const;

const SELLER_ORDER_GROUP_SELECT = {
  id: true,
  createdAt: true,
  paymentStatus: true,
  paymentMethod: true,
  pickupPointId: true,
  pickupPointName: true,
  pickupPointAddress: true,
  handedOverAt: true,
  shippingMethod: { select: { isPickup: true } },
} as const;

type SellerOrderGroupRow = {
  id: string;
  createdAt: Date;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  pickupPointId: string | null;
  pickupPointName: string | null;
  pickupPointAddress: string | null;
  handedOverAt: Date | null;
  shippingMethod: { isPickup: boolean };
  OrderItem: SellerOrderLine[];
};

/** The lines a handover delivers; every other status is left untouched (AC-11). */
const HANDOVER_READY_STATUSES: readonly OrderItemStatus[] = [
  "CONFIRMED",
  "SHIPPED",
];

export const toSellerOrderGroupJson = (row: SellerOrderGroupRow) => ({
  id: row.id,
  createdAt: row.createdAt,
  paymentStatus: row.paymentStatus,
  paymentMethod: row.paymentMethod,
  isPickup: row.shippingMethod.isPickup,
  pickupPointId: row.pickupPointId,
  pickupPointName: row.pickupPointName,
  pickupPointAddress: row.pickupPointAddress,
  handedOverAt: row.handedOverAt,
  orderItems: row.OrderItem,
});

export type SellerOrderGroupJson = ReturnType<typeof toSellerOrderGroupJson>;

/**
 * The moves the per line status route allows: the item is gone, and a line
 * created before this change can still be closed as delivered. Confirming and
 * shipping are no longer a seller's decision, and a line the payment shipped
 * can still be reported gone, because that is where the money comes back
 * (AC-5 as amended on 2026-11-14).
 */
export const ALLOWED_LINE_TRANSITIONS: Record<
  OrderItemStatus,
  readonly OrderItemStatus[]
> = {
  PENDING: [],
  CONFIRMED: ["CANCELLED"],
  OUT_OF_STOCK: [],
  CANCELLED: [],
  SHIPPED: ["CANCELLED", "DELIVERED"],
  DELIVERED: [],
  RETURNED: [],
  BACKORDERED: [],
  REPLACED: [],
};

const sellerNotAssigned = () =>
  new AppError(
    403,
    ORDER_ERROR_CODES.sellerNotAssigned,
    "No business is assigned to this seller.",
  );

const orderItemNotFound = () =>
  new AppError(
    404,
    ORDER_ERROR_CODES.orderItemNotFound,
    "Order item not found.",
  );

const orderNotFound = () =>
  new AppError(
    404,
    ORDER_ERROR_CODES.notFound,
    "Order not found for this seller.",
  );

const nothingToHandOver = () =>
  new AppError(
    409,
    ORDER_ERROR_CODES.nothingToHandOver,
    "No line of this order is ready to hand over.",
  );

const invalidPagination = () =>
  new AppError(422, ORDER_ERROR_CODES.validation, "Invalid pagination.");

const parsePaginationValue = (value: unknown, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) {
    throw invalidPagination();
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw invalidPagination();
  }

  return parsed;
};

const parsePagination = (
  pageInput: unknown,
  limitInput: unknown,
): { page: number; limit: number } => {
  const page = parsePaginationValue(pageInput, 1);
  const limit = Math.min(parsePaginationValue(limitInput, 20), 50);

  if (!Number.isSafeInteger((page - 1) * limit)) {
    throw invalidPagination();
  }

  return { page, limit };
};

export class SellerOrderService {
  async getSellerOrders(
    userId: string,
    pageInput?: unknown,
    limitInput?: unknown,
  ) {
    const { page, limit } = parsePagination(pageInput, limitInput);
    const business = await prisma.business.findUnique({
      where: { ownerUserId: userId },
      select: { id: true },
    });

    if (!business) {
      throw sellerNotAssigned();
    }

    const total = await this.countSellerOrders(userId);
    const orders = await this.findSellerOrders(userId, page, limit);

    return {
      orders: orders.map(toSellerOrderGroupJson),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateSellerOrderItemStatus(
    orderItemId: string,
    userId: string,
    targetStatus: OrderItemStatus,
  ): Promise<SellerOrderItemResult> {
    let orderId: string | null = null;

    try {
      const result = await this.runStatusTransaction(
        orderItemId,
        userId,
        targetStatus,
        (foundOrderId) => {
          orderId = foundOrderId;
        },
      );

      logger.info({
        event: "seller.order_item.status_changed",
        userId,
        orderId,
        orderItemId,
        targetStatus,
        resultCode: "OK",
      });

      return result;
    } catch (error) {
      const fields = {
        event: "seller.order_item.status_refused",
        userId,
        orderId,
        orderItemId,
        targetStatus,
        resultCode: error instanceof AppError ? error.code : "INTERNAL_ERROR",
      };

      if (error instanceof AppError) {
        logger.warn(fields);
      } else {
        logger.error(fields);
      }

      throw error;
    }
  }

  /**
   * One action hands the whole parcel over: every owned line in `CONFIRMED` or
   * `SHIPPED` becomes `DELIVERED` with one server timestamp, the order status is
   * recomputed, and `handedOverAt` is written once, by the transaction that
   * leaves the order `DELIVERED` (AC-11).
   */
  async handOverOrder(
    orderId: string,
    userId: string,
  ): Promise<SellerOrderGroupJson> {
    let businessId: string | null = null;

    try {
      const business = await prisma.business.findUnique({
        where: { ownerUserId: userId },
        select: { id: true },
      });

      if (!business) {
        throw sellerNotAssigned();
      }

      businessId = business.id;

      const { group, deliveredLineCount } = await prisma.$transaction(
        (tx) => this.runHandover(tx, orderId, business.id),
        ORDER_TRANSACTION_OPTIONS,
      );

      logger.info({
        event: "seller.order.handed_over",
        userId,
        orderId,
        businessId,
        deliveredLineCount,
        resultCode: "OK",
      });

      return group;
    } catch (error) {
      const fields = {
        event: "seller.order.handover_refused",
        userId,
        orderId,
        businessId,
        resultCode: error instanceof AppError ? error.code : "INTERNAL_ERROR",
      };

      if (error instanceof AppError) {
        logger.warn(fields);
      } else {
        logger.error(fields);
      }

      throw error;
    }
  }

  private async runHandover(
    tx: Prisma.TransactionClient,
    orderId: string,
    businessId: string,
  ): Promise<{ group: SellerOrderGroupJson; deliveredLineCount: number }> {
    await lockOrder(tx, orderId);

    const order = await tx.order.findFirst({
      where: { id: orderId, OrderItem: { some: { businessId } } },
      select: {
        ...SELLER_ORDER_GROUP_SELECT,
        OrderItem: {
          where: { businessId },
          orderBy: { id: "asc" },
          select: SELLER_ORDER_ITEM_SELECT,
        },
      },
    });

    if (!order) {
      throw orderNotFound();
    }

    const ready = order.OrderItem.filter((line) =>
      HANDOVER_READY_STATUSES.includes(line.status),
    );

    if (ready.length === 0) {
      const everyLineDelivered = order.OrderItem.every(
        (line) => line.status === "DELIVERED",
      );

      if (everyLineDelivered) {
        return {
          group: toSellerOrderGroupJson(order),
          deliveredLineCount: 0,
        };
      }

      throw nothingToHandOver();
    }

    const handedOverAt = new Date();

    await tx.orderItem.updateMany({
      where: { id: { in: ready.map((line) => line.id) } },
      data: { status: "DELIVERED", receiptDate: handedOverAt },
    });

    const status = await recomputeOrderStatus(tx, orderId);

    if (status === "DELIVERED") {
      await tx.order.updateMany({
        where: { id: orderId, handedOverAt: null },
        data: { handedOverAt },
      });
    }

    const group = await tx.order.findFirstOrThrow({
      where: { id: orderId },
      select: {
        ...SELLER_ORDER_GROUP_SELECT,
        OrderItem: {
          where: { businessId },
          orderBy: { id: "asc" },
          select: SELLER_ORDER_ITEM_SELECT,
        },
      },
    });

    return {
      group: toSellerOrderGroupJson(group),
      deliveredLineCount: ready.length,
    };
  }

  private async runStatusTransaction(
    orderItemId: string,
    userId: string,
    targetStatus: OrderItemStatus,
    setOrderId: (orderId: string) => void,
  ): Promise<SellerOrderItemResult> {
    return prisma.$transaction(async (tx) => {
      const reference = await tx.orderItem.findUnique({
        where: { id: orderItemId },
        select: { orderId: true },
      });

      if (!reference) {
        throw orderItemNotFound();
      }

      setOrderId(reference.orderId);
      return this.transitionOrderItem(
        tx,
        orderItemId,
        reference.orderId,
        userId,
        targetStatus,
      );
    }, ORDER_TRANSACTION_OPTIONS);
  }

  private async countSellerOrders(userId: string): Promise<number> {
    const [result] = await prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(DISTINCT oi."orderId")::int AS total
      FROM "OrderItem" oi
      JOIN "Business" b ON b.id = oi."businessId"
      WHERE b."ownerUserId" = ${userId}
    `;

    return result?.total ?? 0;
  }

  private async findSellerOrders(userId: string, page: number, limit: number) {
    return prisma.order.findMany({
      where: {
        OrderItem: {
          some: { business: { is: { ownerUserId: userId } } },
        },
      },
      select: {
        ...SELLER_ORDER_GROUP_SELECT,
        OrderItem: {
          where: { business: { is: { ownerUserId: userId } } },
          orderBy: { id: "asc" },
          select: {
            id: true,
            productId: true,
            name: true,
            previewImage: true,
            quantity: true,
            price: true,
            currency: true,
            status: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  private async transitionOrderItem(
    tx: Prisma.TransactionClient,
    orderItemId: string,
    orderId: string,
    userId: string,
    targetStatus: OrderItemStatus,
  ): Promise<SellerOrderItemResult> {
    await lockOrder(tx, orderId);
    const current = await tx.orderItem.findFirst({
      where: {
        id: orderItemId,
        business: { is: { ownerUserId: userId } },
      },
      select: SELLER_ORDER_ITEM_SELECT,
    });

    if (!current) {
      throw orderItemNotFound();
    }

    if (current.status === targetStatus) {
      return current;
    }

    if (!ALLOWED_LINE_TRANSITIONS[current.status].includes(targetStatus)) {
      throw new AppError(
        409,
        ORDER_ERROR_CODES.invalidTransition,
        `A line cannot move from ${current.status} to ${targetStatus}.`,
        { from: current.status, to: targetStatus },
      );
    }

    return this.applyOrderItemStatus(tx, current, targetStatus);
  }

  /**
   * The server clock stamps the moment: `receiptDate` when the line becomes
   * `DELIVERED`, and `handedOverAt` when that move also closes the order, so a
   * courier order records its handover too and a seller cannot backdate either
   * (AC-12).
   */
  private async applyOrderItemStatus(
    tx: Prisma.TransactionClient,
    current: SellerOrderItemResult,
    targetStatus: OrderItemStatus,
  ): Promise<SellerOrderItemResult> {
    const deliveredAt = targetStatus === "DELIVERED" ? new Date() : null;

    const result = await tx.orderItem.update({
      where: { id: current.id },
      data: {
        status: targetStatus,
        ...(deliveredAt ? { receiptDate: deliveredAt } : {}),
      },
      select: SELLER_ORDER_ITEM_SELECT,
    });

    if (targetStatus === "CANCELLED") {
      await returnOrderStock(tx, [result]);

      // The item is gone after the buyer paid: the money is owed back, and the
      // log line is the only signal until the refund route exists (AC-6).
      const order = await tx.order.findUniqueOrThrow({
        where: { id: current.orderId },
        select: { paymentStatus: true },
      });

      if (order.paymentStatus === "PAID") {
        logger.warn({
          event: "payment.refund_owed",
          orderId: current.orderId,
          orderItemId: result.id,
          amount: result.price.mul(result.quantity).toFixed(2),
          currency: result.currency,
        });
      }
    }

    const orderStatus = await recomputeOrderStatus(tx, current.orderId);

    if (deliveredAt && orderStatus === "DELIVERED") {
      await tx.order.updateMany({
        where: { id: current.orderId, handedOverAt: null },
        data: { handedOverAt: deliveredAt },
      });
    }

    return result;
  }
}
