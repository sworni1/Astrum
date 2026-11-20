import type { Order, OrderItem } from "@astrum/db/client";
import { Prisma } from "@astrum/db/client";
import type { PaymentStatus } from "@astrum/db/enums";
import { logger } from "../../common/helpers/logger";
import {
  closeOrder,
  lockOrder,
  recomputeOrderStatus,
} from "../order/order-status.helpers";
import { toMinorUnits } from "./payment.money";

export type OrderWithLines = Order & { OrderItem: OrderItem[] };

export type ExpiryOutcome = "closed" | "seller" | "unchanged";

export type ApplyResult = "applied" | "ignored";

const UNKNOWN_ERROR_CODE = "unknown";

const ERROR_MESSAGE_LIMIT = 255;

export const amountMatchesOrder = (
  order: Order,
  amount: number | null,
  currency: string | null,
): boolean => {
  if (amount === null || currency === null) {
    return false;
  }

  return (
    amount === toMinorUnits(order.grandTotal) &&
    currency.toLowerCase() === order.currency.toLowerCase()
  );
};

const loadLockedOrder = async (
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<OrderWithLines> => {
  await lockOrder(tx, orderId);

  return await tx.order.findFirstOrThrow({
    where: { id: orderId },
    include: { OrderItem: true },
  });
};

const setPaymentStatus = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  from: readonly PaymentStatus[],
  to: PaymentStatus,
): Promise<number> => {
  const { count } = await tx.order.updateMany({
    where: { id: orderId, paymentStatus: { in: [...from] } },
    data: { paymentStatus: to },
  });

  return count;
};

export const applyPaidEvent = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  attemptId: string,
  paymentIntentId: string | null,
): Promise<ApplyResult> => {
  const attempt = await tx.payment.findUniqueOrThrow({
    where: { id: attemptId },
  });

  if (attempt.status === "PAID") {
    return "ignored";
  }

  const order = await loadLockedOrder(tx, orderId);

  if (order.paymentStatus === "PAID") {
    return "ignored";
  }

  await tx.payment.update({
    where: { id: attempt.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      ...(attempt.providerPaymentIntentId === null && paymentIntentId !== null
        ? { providerPaymentIntentId: paymentIntentId }
        : {}),
    },
  });

  await setPaymentStatus(
    tx,
    order.id,
    ["PENDING", "FAILED", "CANCELLED"],
    "PAID",
  );

  const { count: lineCount } = await tx.orderItem.updateMany({
    where: { orderId: order.id, status: "PENDING" },
    data: { status: "CONFIRMED" },
  });

  const status = await recomputeOrderStatus(tx, order.id);

  logger.info({
    event: "payment.lines_confirmed",
    orderId: order.id,
    paymentId: attempt.id,
    lineCount,
  });

  const lateAttempt =
    attempt.status === "CANCELLED" || attempt.status === "EXPIRED";

  if (lateAttempt || status === "CANCELED") {
    logger.warn({
      event: "payment.refund_owed",
      orderId: order.id,
      paymentId: attempt.id,
      reason: "late_payment",
      amount: attempt.amount.toFixed(2),
      currency: attempt.currency,
    });
  }

  return "applied";
};

export const applyExpiredEvent = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  attemptId: string,
): Promise<ExpiryOutcome> => {
  const { count } = await tx.payment.updateMany({
    where: { id: attemptId, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "EXPIRED" },
  });

  if (count === 0) {
    return "unchanged";
  }

  const order = await loadLockedOrder(tx, orderId);

  await setPaymentStatus(tx, order.id, ["PENDING", "FAILED"], "CANCELLED");

  if (order.status !== "PENDING") {
    logger.warn({
      event: "payment.expired_after_seller_action",
      orderId: order.id,
      paymentId: attemptId,
      status: order.status,
    });

    return "seller";
  }

  await closeOrder(tx, order);

  return "closed";
};

export const applyDeclinedEvent = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  attemptId: string,
  decline: { code: string | null; message: string | null },
): Promise<ApplyResult> => {
  const attempt = await tx.payment.findUniqueOrThrow({
    where: { id: attemptId },
  });

  if (attempt.status !== "PENDING") {
    return "ignored";
  }

  await tx.payment.update({
    where: { id: attempt.id },
    data: {
      lastErrorCode: decline.code ?? UNKNOWN_ERROR_CODE,
      lastErrorMessage: decline.message?.slice(0, ERROR_MESSAGE_LIMIT) ?? null,
    },
  });

  const changed = await setPaymentStatus(tx, orderId, ["PENDING"], "FAILED");

  return changed > 0 ? "applied" : "ignored";
};

export const applyAsyncFailedEvent = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  attemptId: string,
): Promise<ApplyResult> => {
  const { count } = await tx.payment.updateMany({
    where: { id: attemptId, status: "PENDING" },
    data: { status: "FAILED" },
  });

  if (count === 0) {
    return "ignored";
  }

  await setPaymentStatus(tx, orderId, ["PENDING"], "FAILED");

  return "applied";
};
