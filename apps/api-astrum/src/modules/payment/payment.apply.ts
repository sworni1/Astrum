import type { Order, OrderItem } from "../../../generated/prisma/client";
import { Prisma } from "../../../generated/prisma/client";
import type { PaymentStatus } from "../../../generated/prisma/enums";
import { logger } from "../../common/helpers/logger";
import { closeOrder, lockOrder } from "../order/order-status.helpers";
import { toMinorUnits } from "./payment.money";

export type OrderWithLines = Order & { OrderItem: OrderItem[] };

/** What an expiry did: it closed an untouched order, or it left a seller's one. */
export type ExpiryOutcome = "closed" | "seller" | "unchanged";

export type ApplyResult = "applied" | "ignored";

const UNKNOWN_ERROR_CODE = "unknown";

const ERROR_MESSAGE_LIMIT = 255;

/**
 * The amount and the currency the provider reports against the stored order,
 * compared in the one conversion helper both sides share (AC-5, invariant 5).
 */
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

/** Every write below happens under the order row lock, so two callers serialise. */
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

/**
 * Money arrived. The order status is never touched and the stock never moves,
 * because stock left the shelf when the order was created. An attempt that was
 * cancelled or expired first still becomes PAID, and the line says a refund is
 * owed rather than dropping money that did leave (AC-6, AC-12).
 */
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

  await setPaymentStatus(tx, order.id, ["PENDING", "FAILED", "CANCELLED"], "PAID");

  if (attempt.status === "CANCELLED" || attempt.status === "EXPIRED") {
    logger.warn({
      event: "payment.refund_owed",
      orderId: order.id,
      paymentId: attempt.id,
      amount: attempt.amount.toFixed(2),
      currency: attempt.currency,
    });
  }

  return "applied";
};

/**
 * The window closed. An order no seller has touched is closed through the same
 * helper the customer cancel uses, so the stock comes back once; an order the
 * seller already accepted keeps its lines and stock and only loses its payment
 * (AC-8).
 */
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

/**
 * The card was declined. The attempt stays PENDING, because the hosted session
 * is still usable for a retry; only the reason and the order label change (AC-7).
 */
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

/** An async failure ends the attempt; the stock stays where it is (AC-7). */
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
