import type { Payment } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import type { OrderWithLines } from "./payment.apply";
import type { ProviderEvent } from "./payment.gateway";

/** One attempt together with the order it belongs to, loaded in one query. */
export type AttemptWithOrder = Payment & { order: OrderWithLines };

const ATTEMPT_WITH_ORDER = {
  order: { include: { OrderItem: true } },
} as const;

/** The attempt the order screen and the sweep read: newest first, still payable. */
export const newestOpenAttempt = async (
  orderId: string,
): Promise<Payment | null> =>
  await prisma.payment.findFirst({
    where: { orderId, status: { in: ["PENDING", "FAILED"] } },
    orderBy: { createdAt: "desc" },
  });

/** A stored session with a future deadline is reused instead of a second create. */
export const reusableAttempt = async (
  orderId: string,
  now: Date,
): Promise<Payment | null> =>
  await prisma.payment.findFirst({
    where: {
      orderId,
      status: { in: ["PENDING", "FAILED"] },
      checkoutUrl: { not: null },
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

const bySession = async (sessionId: string): Promise<AttemptWithOrder | null> =>
  await prisma.payment.findUnique({
    where: { providerSessionId: sessionId },
    include: ATTEMPT_WITH_ORDER,
  });

const byIntent = async (
  paymentIntentId: string,
): Promise<AttemptWithOrder | null> =>
  await prisma.payment.findFirst({
    where: { providerPaymentIntentId: paymentIntentId },
    include: ATTEMPT_WITH_ORDER,
  });

const pendingOfOrder = async (
  orderId: string,
): Promise<AttemptWithOrder | null> =>
  await prisma.payment.findFirst({
    where: { orderId, status: "PENDING", providerSessionId: null },
    orderBy: { createdAt: "desc" },
    include: ATTEMPT_WITH_ORDER,
  });

/**
 * A session named by a callback can arrive before the pay route stored its id
 * (the customer paid faster than the answer was written). The order it names
 * still has one PENDING attempt with no session id, so that attempt adopts the
 * id and the next delivery takes the unique index branch (AC-5).
 */
const adoptSession = async (
  attempt: AttemptWithOrder,
  sessionId: string | null,
): Promise<AttemptWithOrder> => {
  if (sessionId === null) {
    return attempt;
  }

  const updated = await prisma.payment.update({
    where: { id: attempt.id },
    data: { providerSessionId: sessionId },
  });

  return { ...attempt, ...updated };
};

/**
 * The callback is matched to one attempt: by the session id it carries, then by
 * its payment intent, then by the order id in `metadata.order_id` (AC-5).
 */
export const findAttemptForEvent = async (
  event: ProviderEvent,
): Promise<AttemptWithOrder | null> => {
  if (event.sessionId !== null) {
    const found = await bySession(event.sessionId);

    if (found) {
      return found;
    }
  }

  if (event.paymentIntentId !== null) {
    const found = await byIntent(event.paymentIntentId);

    if (found) {
      return found;
    }
  }

  if (event.orderId === null) {
    return null;
  }

  const attempt = await pendingOfOrder(event.orderId);

  if (!attempt) {
    return null;
  }

  return await adoptSession(attempt, event.sessionId);
};
