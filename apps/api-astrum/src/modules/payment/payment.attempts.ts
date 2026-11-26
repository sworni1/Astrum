import type { Payment } from "@astrum/db/client";
import { prisma } from "../../../lib/prisma";
import type { OrderWithLines } from "../order/order-status";
import {
  ATTEMPT_OPEN_STATUSES,
  ATTEMPT_WITH_ORDER_INCLUDE,
} from "./constants/payment.constants";
import type { ProviderEvent } from "./types/payment.types";

type AttemptWithOrder = Payment & { order: OrderWithLines };

export const newestOpenAttempt = async (
  orderId: string,
): Promise<Payment | null> =>
  await prisma.payment.findFirst({
    where: { orderId, status: { in: [...ATTEMPT_OPEN_STATUSES] } },
    orderBy: { createdAt: "desc" },
  });

export const reusableAttempt = async (
  orderId: string,
  now: Date,
): Promise<Payment | null> =>
  await prisma.payment.findFirst({
    where: {
      orderId,
      status: { in: [...ATTEMPT_OPEN_STATUSES] },
      checkoutUrl: { not: null },
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

const bySession = async (sessionId: string): Promise<AttemptWithOrder | null> =>
  await prisma.payment.findUnique({
    where: { providerSessionId: sessionId },
    include: ATTEMPT_WITH_ORDER_INCLUDE,
  });

const byIntent = async (
  paymentIntentId: string,
): Promise<AttemptWithOrder | null> =>
  await prisma.payment.findFirst({
    where: { providerPaymentIntentId: paymentIntentId },
    include: ATTEMPT_WITH_ORDER_INCLUDE,
  });

const pendingOfOrder = async (
  orderId: string,
): Promise<AttemptWithOrder | null> =>
  await prisma.payment.findFirst({
    where: { orderId, status: "PENDING", providerSessionId: null },
    orderBy: { createdAt: "desc" },
    include: ATTEMPT_WITH_ORDER_INCLUDE,
  });

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
