import type { OrderItem } from "@astrum/db/client";
import { Prisma } from "@astrum/db/client";
import type {
  Currency,
  OrderItemStatus,
  PaymentStatus,
} from "@astrum/db/enums";
import { AppError } from "../../common/helpers/appError";
import { logger } from "../../common/helpers/logger";
import { returnOrderStock } from "../order/order-status.helpers";

/**
 * The lines a cancel closes at a counter or at a door. A delivered line is never
 * one of them, and the set is read under the order lock, never taken from the
 * request (spec 0018, AC-6; spec 0019, AC-8).
 */
export const CANCELLABLE_STATUSES: readonly OrderItemStatus[] = [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
];

export type CancelLine = Pick<
  OrderItem,
  "id" | "productId" | "price" | "quantity" | "status"
>;

export type DeliverableLine = Pick<OrderItem, "id" | "status">;

/** The money a cancel names: goods only, never the delivery price (spec 0018, AC-8). */
export const sumOfLines = (lines: readonly CancelLine[]): string =>
  lines
    .reduce(
      (sum, line) => sum.add(line.price.mul(line.quantity)),
      new Prisma.Decimal(0),
    )
    .toFixed(2);

/** Whether a line belongs to the set a cancel may close. */
export const isCancellable = (line: DeliverableLine): boolean =>
  CANCELLABLE_STATUSES.includes(line.status);

/**
 * Cancels exactly these lines and returns their stock once. The caller reads the
 * set under the order lock, so a second press finds nothing left to cancel
 * (spec 0018, AC-7; spec 0019, AC-8).
 */
export const cancelOrderLines = async (
  tx: Prisma.TransactionClient,
  lines: readonly CancelLine[],
): Promise<void> => {
  if (lines.length === 0) {
    return;
  }

  await tx.orderItem.updateMany({
    where: { id: { in: lines.map((line) => line.id) } },
    data: { status: "CANCELLED" },
  });
  await returnOrderStock(tx, [...lines]);
};

/**
 * Delivers every shipped line of one order with one server timestamp, and leaves
 * every other line untouched. The count it answers is the number of lines that
 * moved (spec 0018, AC-5; spec 0019, AC-6).
 */
export const deliverShippedLines = async (
  tx: Prisma.TransactionClient,
  lines: readonly DeliverableLine[],
  timestamp: Date,
): Promise<number> => {
  const shipped = lines.filter((line) => line.status === "SHIPPED");

  if (shipped.length === 0) {
    return 0;
  }

  const { count } = await tx.orderItem.updateMany({
    where: { id: { in: shipped.map((line) => line.id) } },
    data: { status: "DELIVERED", receiptDate: timestamp },
  });

  return count;
};

export type CancelPaymentInput = {
  tx: Prisma.TransactionClient;
  orderId: string;
  paymentStatus: PaymentStatus;
  reason: string;
  actorUserId: string;
  buyerUserId: string;
  amount: string;
  currency: Currency;
  cancelledLineCount: number;
  /** The counter fills its point; a courier has none and omits it (spec 0019, AC-8). */
  pointId?: string;
};

/**
 * Resolves the money of a cancelled order: an open attempt becomes cancelled, an
 * order that was never paid reads cancelled, and a paid order keeps `PAID` and
 * leaves one warning naming the money owed back. No route refunds anything
 * (spec 0018, AC-8; spec 0019, AC-8).
 */
export const resolveCancelPayment = async ({
  tx,
  orderId,
  paymentStatus,
  reason,
  actorUserId,
  buyerUserId,
  amount,
  currency,
  cancelledLineCount,
  pointId,
}: CancelPaymentInput): Promise<void> => {
  await tx.payment.updateMany({
    where: { orderId, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "CANCELLED" },
  });

  if (paymentStatus === "PENDING" || paymentStatus === "FAILED") {
    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: "CANCELLED" },
    });
  }

  if (paymentStatus !== "PAID") {
    return;
  }

  logger.warn({
    event: "payment.refund_owed",
    reason,
    orderId,
    buyerUserId,
    actorUserId,
    ...(pointId ? { pointId } : {}),
    amount,
    currency,
    cancelledLineCount,
  });
};

/**
 * One structured line for a refused write: a warning for an expected refusal code
 * and an error for anything the code table does not explain (spec 0018, AC-6).
 */
export const logWriteRefusal = (
  event: string,
  fields: Record<string, unknown>,
  error: unknown,
): void => {
  const line = {
    event,
    ...fields,
    resultCode: error instanceof AppError ? error.code : "INTERNAL_ERROR",
  };

  if (error instanceof AppError) {
    logger.warn(line);
    return;
  }

  logger.error(line);
};
