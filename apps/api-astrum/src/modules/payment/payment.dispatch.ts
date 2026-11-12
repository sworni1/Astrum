import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import { ORDER_TRANSACTION_OPTIONS } from "../order/order-status.helpers";
import {
  type ApplyResult,
  type ExpiryOutcome,
  applyAsyncFailedEvent,
  applyDeclinedEvent,
  applyExpiredEvent,
  applyPaidEvent,
} from "./payment.apply";
import { PAYMENT_EVENT_TYPES } from "./payment.constants";
import type { ProviderEvent, ProviderSession } from "./payment.gateway";
import { sessionOutcomeOf } from "./payment.money";

export type TransitionResult = ApplyResult | ExpiryOutcome;

export type AttemptTarget = { orderId: string; attemptId: string };

export const inTransaction = async <T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> => await prisma.$transaction(work, ORDER_TRANSACTION_OPTIONS);

/**
 * One retrieved session, whatever asked for it (a callback, the sync route or the
 * sweep), lands on the same three transitions (AC-9, AC-10).
 */
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
    return await inTransaction((tx) =>
      applyExpiredEvent(tx, target.orderId, target.attemptId),
    );
  }

  return "ignored";
};

/** A verified callback, dispatched on its type (AC-5, AC-7, AC-8). */
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
      return await inTransaction((tx) =>
        applyExpiredEvent(tx, target.orderId, target.attemptId),
      );
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
