import type { OrderItem } from "@astrum/db/client";
import { Prisma } from "@astrum/db/client";
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

type PointOrderLine = Pick<
  OrderItem,
  | "id"
  | "name"
  | "previewImage"
  | "quantity"
  | "price"
  | "currency"
  | "status"
>;

type PointOrderRow = {
  id: string;
  createdAt: Date;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  handedOverAt: Date | null;
  grandTotal: Prisma.Decimal;
  currency: Currency;
  OrderItem: PointOrderLine[];
};

const POINT_ORDER_LINE_SELECT = {
  id: true,
  name: true,
  previewImage: true,
  quantity: true,
  price: true,
  currency: true,
  status: true,
} as const;

/**
 * The counter's card carries what a worker needs to find a parcel and no buyer
 * identity: no `userId`, name, email, phone or address (AC-2).
 */
const POINT_ORDER_SELECT = {
  id: true,
  createdAt: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  handedOverAt: true,
  grandTotal: true,
  currency: true,
  OrderItem: {
    orderBy: { id: "asc" },
    select: POINT_ORDER_LINE_SELECT,
  },
} as const;

/** The cancel also returns stock, so it reads the product of every line. */
const CANCEL_ORDER_SELECT = {
  ...POINT_ORDER_SELECT,
  userId: true,
  OrderItem: {
    orderBy: { id: "asc" },
    select: { ...POINT_ORDER_LINE_SELECT, productId: true },
  },
} as const;

export const toPointOrderJson = (row: PointOrderRow) => ({
  id: row.id,
  createdAt: row.createdAt,
  status: row.status,
  paymentStatus: row.paymentStatus,
  paymentMethod: row.paymentMethod,
  handedOverAt: row.handedOverAt,
  grandTotal: toMoney(row.grandTotal),
  currency: row.currency,
  orderItems: row.OrderItem.map((line) => ({
    ...line,
    price: toMoney(line.price),
  })),
});

export type PointOrderJson = ReturnType<typeof toPointOrderJson>;

export type PointOrdersPage = {
  orders: PointOrderJson[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const invalidPagination = () =>
  new AppError(422, STAFF_ERROR_CODES.validation, "Invalid pagination.");

const orderNotFound = () =>
  new AppError(
    404,
    ORDER_ERROR_CODES.notFound,
    "Order not found at this pickup point.",
  );

const pickupPointInactive = () =>
  new AppError(
    409,
    STAFF_ERROR_CODES.pickupPointInactive,
    "This pickup point is switched off.",
  );

const alreadyHandedOver = () =>
  new AppError(
    409,
    STAFF_ERROR_CODES.alreadyHandedOver,
    "This order was already handed over.",
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

/**
 * The counter's own reads and writes. Every route is scoped by the point the
 * role guard resolved, and every write runs one chain of checks inside one
 * transaction under the order lock (spec 0018).
 */
export class PointOrderService {
  /** The arrived parcels waiting at one point, oldest first, one page at a time (AC-1 to AC-3, spec 0031 AC-4). */
  async listPointOrders(
    pickupPointId: string,
    pageInput?: unknown,
    limitInput?: unknown,
  ): Promise<PointOrdersPage> {
    const { page, limit } = parsePagination(
      pageInput,
      limitInput,
      invalidPagination,
    );
    const where = { pickupPointId, status: "DELIVERED" as const };
    const total = await prisma.order.count({ where });
    const orders = await prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: POINT_ORDER_SELECT,
    });

    return {
      orders: orders.map(toPointOrderJson),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * One press closes the whole parcel: the delivered lines become issued, and the
   * order is stamped once (AC-4, AC-5; spec 0031, AC-3).
   */
  async handOver(
    orderId: string,
    userId: string,
    pickupPointId: string,
  ): Promise<{ order: PointOrderJson }> {
    try {
      const { order, issuedLineCount } = await prisma.$transaction(
        (tx) => this.runHandover(tx, orderId, pickupPointId),
        ORDER_TRANSACTION_OPTIONS,
      );

      logger.info({
        event: "staff.point.handed_over",
        userId,
        pointId: pickupPointId,
        orderId,
        issuedLineCount,
        resultCode: "OK",
      });

      return { order };
    } catch (error) {
      logWriteRefusal(
        "staff.point.handover_refused",
        { userId, pointId: pickupPointId, orderId },
        error,
      );
      throw error;
    }
  }

  /**
   * The buyer changed their mind at the counter: every line still in the parcel
   * is cancelled and its stock comes back once, a delivered line stays, and a
   * paid order leaves one warning naming the money owed back (AC-6 to AC-8).
   */
  async cancelOrder(
    orderId: string,
    userId: string,
    pickupPointId: string,
  ): Promise<{ order: PointOrderJson }> {
    try {
      // The provider call goes before the transaction, never while the order row
      // is locked, and it only runs for this point's own order (AC-8).
      await this.assertOwnOrder(orderId, pickupPointId);
      await expireSessionForCancel(orderId);

      const { order, cancelledLineCount, cancelledProductIds } =
        await prisma.$transaction(
          (tx) => this.runCancel(tx, orderId, userId, pickupPointId),
          ORDER_TRANSACTION_OPTIONS,
        );

      // The counter's cancel returns stock, so the next read must see it (AC-7 b).
      await invalidateStockOfProducts(cancelledProductIds);

      logger.info({
        event: "staff.point.cancelled",
        userId,
        pointId: pickupPointId,
        orderId,
        cancelledLineCount,
        resultCode: "OK",
      });

      return { order };
    } catch (error) {
      logWriteRefusal(
        "staff.point.cancel_refused",
        { userId, pointId: pickupPointId, orderId },
        error,
      );
      throw error;
    }
  }

  private async assertOwnOrder(
    orderId: string,
    pickupPointId: string,
  ): Promise<void> {
    const owned = await prisma.order.findFirst({
      where: { id: orderId, pickupPointId },
      select: { id: true },
    });

    if (owned === null) {
      throw orderNotFound();
    }
  }

  private async runHandover(
    tx: Prisma.TransactionClient,
    orderId: string,
    pickupPointId: string,
  ): Promise<{ order: PointOrderJson; issuedLineCount: number }> {
    await lockOrder(tx, orderId);

    const order = await tx.order.findFirst({
      where: { id: orderId, pickupPointId },
      select: POINT_ORDER_SELECT,
    });

    // A missing order and another point's order answer the same code, so the
    // answer never says whether an order exists (AC-4).
    if (!order) {
      throw orderNotFound();
    }

    await this.requireActivePoint(tx, pickupPointId);

    if (order.handedOverAt !== null) {
      throw alreadyHandedOver();
    }

    if (order.status !== "DELIVERED") {
      throw orderNotDelivered();
    }

    const timestamp = new Date();
    const count = await issueDeliveredLines(tx, order.OrderItem);

    const status = await recomputeOrderStatus(tx, orderId);

    if (status === "ISSUED") {
      await tx.order.updateMany({
        where: { id: orderId, handedOverAt: null },
        data: { handedOverAt: timestamp },
      });
    }

    const answered = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: POINT_ORDER_SELECT,
    });

    return { order: toPointOrderJson(answered), issuedLineCount: count };
  }

  private async runCancel(
    tx: Prisma.TransactionClient,
    orderId: string,
    userId: string,
    pickupPointId: string,
  ): Promise<{
    order: PointOrderJson;
    cancelledLineCount: number;
    cancelledProductIds: string[];
  }> {
    await lockOrder(tx, orderId);

    const order = await tx.order.findFirst({
      where: { id: orderId, pickupPointId },
      select: CANCEL_ORDER_SELECT,
    });

    if (!order) {
      throw orderNotFound();
    }

    await this.requireActivePoint(tx, pickupPointId);

    // Read under the lock, never from the request: so the stock comes back once
    // even after a second press or a lost answer (AC-7).
    const cancellable = order.OrderItem.filter(isCancellable);

    if (cancellable.length === 0) {
      throw nothingToCancel();
    }

    if (order.status !== "DELIVERED") {
      throw orderNotDelivered();
    }

    await cancelOrderLines(tx, cancellable);
    await recomputeOrderStatus(tx, orderId);

    await resolveCancelPayment({
      tx,
      orderId,
      paymentStatus: order.paymentStatus,
      reason: "point_cancel",
      actorUserId: userId,
      buyerUserId: order.userId,
      pointId: pickupPointId,
      amount: sumOfLines(cancellable),
      currency: order.currency,
      cancelledLineCount: cancellable.length,
    });

    const answered = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: POINT_ORDER_SELECT,
    });

    return {
      order: toPointOrderJson(answered),
      cancelledLineCount: cancellable.length,
      cancelledProductIds: cancellable.map((line) => line.productId),
    };
  }

  /** A switched off point refuses both writes and keeps its queue (AC-9). */
  private async requireActivePoint(
    tx: Prisma.TransactionClient,
    pickupPointId: string,
  ): Promise<void> {
    const point = await tx.pickupPoint.findUnique({
      where: { id: pickupPointId },
      select: { isActive: true },
    });

    if (!point?.isActive) {
      throw pickupPointInactive();
    }
  }

}
