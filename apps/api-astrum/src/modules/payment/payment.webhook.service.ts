import { prisma } from "../../../lib/prisma";
import { logger } from "../../common/helpers/logger";
import { hasUniqueViolationCode } from "../../common/helpers/prismaErrors";
import { PAYMENT_PROVIDER } from "./constants/payment.constants";
import { amountMatchesOrder, toMinorUnits } from "./helpers/payment.helpers";
import { findAttemptForEvent } from "./payment.attempts";
import { applyProviderEvent } from "./payment.dispatch";
import type { ProviderEvent } from "./types/payment.types";

export type WebhookOutcome =
  | "applied"
  | "replayed"
  | "unmatched"
  | "mismatch"
  | "ignored";

const recordDelivery = async (event: ProviderEvent) => {
  try {
    return await prisma.paymentEvent.create({
      data: {
        provider: PAYMENT_PROVIDER,
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
    if (hasUniqueViolationCode(error)) {
      return null;
    }

    throw error;
  }
};

const releaseDelivery = async (id: string): Promise<void> => {
  try {
    await prisma.paymentEvent.delete({ where: { id } });
  } catch (error) {
    logger.error({
      event: "payment.webhook.release_failed",
      paymentEventId: id,
      reason: error instanceof Error ? error.message : String(error),
    });
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

  try {
    return await applyStoredEvent(stored.id, event);
  } catch (error) {
    await releaseDelivery(stored.id);
    throw error;
  }
};

const applyStoredEvent = async (
  storedId: string,
  event: ProviderEvent,
): Promise<WebhookOutcome> => {
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

  if (!amountMatchesOrder(attempt.order, event.amount, event.currency)) {
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
    where: { id: storedId },
    data: { applied: true, paymentId: attempt.id },
  });

  return "applied";
};
