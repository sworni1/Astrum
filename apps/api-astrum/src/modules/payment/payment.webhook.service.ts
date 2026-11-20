import { prisma } from "../../../lib/prisma";
import { logger } from "../../common/helpers/logger";
import { amountMatchesOrder } from "./payment.apply";
import { findAttemptForEvent } from "./payment.attempts";
import { applyProviderEvent } from "./payment.dispatch";
import type { ProviderEvent } from "./payment.gateway";
import { toMinorUnits } from "./payment.money";

export type WebhookOutcome =
  | "applied"
  | "replayed"
  | "unmatched"
  | "mismatch"
  | "ignored";

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === "P2002";

const recordDelivery = async (event: ProviderEvent) => {
  try {
    return await prisma.paymentEvent.create({
      data: {
        provider: "STRIPE",
        eventId: event.id,
        type: event.type,
        orderId: event.orderId,
        sessionId: event.sessionId,
        amountTotal: event.amount,
        currency: event.currency,
        sessionStatus: event.sessionStatus,
        paymentStatus: event.paymentStatus,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return null;
    }

    throw error;
  }
};

export const handleWebhookEvent = async (
  event: ProviderEvent,
): Promise<WebhookOutcome> => {
  const stored = await recordDelivery(event);

  if (stored === null) {
    logger.info({ event: "payment.webhook.replayed", eventId: event.id });

    return "replayed";
  }

  const attempt = await findAttemptForEvent(event);

  if (attempt === null) {
    logger.warn({
      event: "payment.webhook.unmatched",
      eventId: event.id,
      orderId: event.orderId,
      sessionId: event.sessionId,
    });

    return "unmatched";
  }

  if (
    !amountMatchesOrder(attempt.order, event.amount, event.currency)
  ) {
    logger.warn({
      event: "payment.webhook.amount_mismatch",
      eventId: event.id,
      orderId: attempt.order.id,
      amount: event.amount,
      expected: toMinorUnits(attempt.order.grandTotal),
      currency: event.currency,
    });

    return "mismatch";
  }

  const result = await applyProviderEvent(event, {
    orderId: attempt.order.id,
    attemptId: attempt.id,
  });

  if (result !== "applied") {
    return "ignored";
  }

  await prisma.paymentEvent.update({
    where: { id: stored.id },
    data: { applied: true, paymentId: attempt.id },
  });

  return "applied";
};
