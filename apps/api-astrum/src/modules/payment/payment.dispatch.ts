import { Prisma } from "@astrum/db/client";
import { prisma } from "../../../lib/prisma";
import { ORDER_TRANSACTION_OPTIONS } from "../order/order-status.helpers";
import { invalidateStockOfOrder } from "../order/order-cache";
import {
  type ApplyResult,
  type ExpiryOutcome,
  applyAsyncFailedEvent,
  applyDeclinedEvent,
  applyExpiredEvent,
  applyPaidEvent,
} from "./payment.apply";
import { PAYMENT_EVENT_TYPES } from "./constants/payment.constants";
import type { ProviderEvent, ProviderSession } from "./payment.gateway";
import { sessionOutcomeOf } from "./payment.money";

export type TransitionResult = ApplyResult | ExpiryOutcome;

export type AttemptTarget = { orderId: string; attemptId: string };

export const inTransaction = async <T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> => await prisma.$transaction(work, ORDER_TRANSACTION_OPTIONS);

const expireAfterCommit = async (
  target: AttemptTarget,
): Promise<TransitionResult> => {
  const outcome = await inTransaction((tx) =>
    applyExpiredEvent(tx, target.orderId, target.attemptId),
  );

  if (outcome === "closed") {
    await invalidateStockOfOrder(target.orderId);
  }

  return outcome;
};

export const applySession = async (
  session: ProviderSession,
  target: AttemptTarget,
): Promise<TransitionResult> => {
  const outcome = sessionOutcomeOf(session.status, session.paymentStatus);

  if (outcome === "paid") {
    return await inTransaction((tx) =>
      applyPaidEvent(
        tx,
        target.orderId,
        target.attemptId,
        session.paymentIntentId,
      ),
    );
  }

  if (outcome === "expired") {
    return await expireAfterCommit(target);
  }

  return "ignored";
};

export const applyProviderEvent = async (
  event: ProviderEvent,
  target: AttemptTarget,
): Promise<TransitionResult> => {
  switch (event.type) {
    case PAYMENT_EVENT_TYPES.sessionCompleted:
      return sessionOutcomeOf(event.sessionStatus, event.paymentStatus) ===
        "paid"
        ? await inTransaction((tx) =>
            applyPaidEvent(
              tx,
              target.orderId,
              target.attemptId,
              event.paymentIntentId,
            ),
          )
        : "ignored";
    case PAYMENT_EVENT_TYPES.sessionExpired:
      return await expireAfterCommit(target);
    case PAYMENT_EVENT_TYPES.sessionAsyncFailed:
      return await inTransaction((tx) =>
        applyAsyncFailedEvent(tx, target.orderId, target.attemptId),
      );
    case PAYMENT_EVENT_TYPES.intentFailed:
      return await inTransaction((tx) =>
        applyDeclinedEvent(tx, target.orderId, target.attemptId, {
          code: event.declineCode,
          message: event.errorMessage,
        }),
      );
    default:
      return "ignored";
  }
};
