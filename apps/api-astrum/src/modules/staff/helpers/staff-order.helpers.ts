import type { OrderItem } from "@astrum/db/client";
import { Prisma } from "@astrum/db/client";
import type { Currency, PaymentStatus } from "@astrum/db/enums";
import { AppError } from "../../../common/helpers/appError";
import { logger } from "../../../common/helpers/logger";
import { returnOrderStock } from "../../order/order-status";
import { CANCELLABLE_STATUSES } from "../constants/staff-order.constants";

export type CancelLine = Pick<
  OrderItem,
  "id" | "productId" | "price" | "quantity" | "status"
>;

export type DeliverableLine = Pick<OrderItem, "id" | "status">;

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

  pointId?: string;
};

export const sumOfLines = (lines: readonly CancelLine[]): string =>
  lines
    .reduce(
      (sum, line) => sum.add(line.price.mul(line.quantity)),
      new Prisma.Decimal(0),
    )
    .toFixed(2);

export const isCancellable = (line: DeliverableLine): boolean =>
  CANCELLABLE_STATUSES.includes(line.status);

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

export const issueDeliveredLines = async (
  tx: Prisma.TransactionClient,
  lines: readonly DeliverableLine[],
): Promise<number> => {
  const delivered = lines.filter((line) => line.status === "DELIVERED");

  if (delivered.length === 0) {
    return 0;
  }

  const { count } = await tx.orderItem.updateMany({
    where: { id: { in: delivered.map((line) => line.id) } },
    data: { status: "ISSUED" },
  });

  return count;
};

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
