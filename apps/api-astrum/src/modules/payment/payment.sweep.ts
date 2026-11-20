import { Prisma } from "@astrum/db/client";
import type { PaymentAttemptStatus } from "@astrum/db/enums";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../common/helpers/logger";
import { SWEEP_TRANSACTION_OPTIONS } from "../../common/helpers/sweepTransaction";
import { invalidateStockOfOrder } from "../order/order-cache";
import { applyExpiredEvent, applyPaidEvent } from "./payment.apply";
import {
  PAYMENT_SWEEP_BATCH,
  PAYMENT_SWEEP_INTERVAL_MS,
  PAYMENT_SWEEP_LOCK_KEY,
} from "./constants/payment.constants";
import type { PaymentGateway } from "./payment.gateway";
import { paymentGateway } from "./payment.gateway.registry";
import { sessionOutcomeOf } from "./payment.money";

const SWEEP_INCLUDE = {
  payments: {
    where: { status: { in: ["PENDING", "FAILED"] as PaymentAttemptStatus[] } },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
};

type SweepOrder = Prisma.OrderGetPayload<{ include: typeof SWEEP_INCLUDE }>;

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const logClosed = (orderId: string, paymentId: string): void => {
  logger.info({ event: "payment.sweep.closed", orderId, paymentId });
};

const closeWithoutSession = async (
  tx: Prisma.TransactionClient,
  order: SweepOrder,
  attemptId: string | null,
  closedOrderIds: string[],
): Promise<void> => {
  if (attemptId === null) {
    logger.warn({
      event: "payment.sweep.no_attempt",
      orderId: order.id,
    });

    return;
  }

  const outcome = await applyExpiredEvent(tx, order.id, attemptId);

  if (outcome === "closed") {
    closedOrderIds.push(order.id);
    logClosed(order.id, attemptId);
  }
};

const sweepWithSession = async (
  tx: Prisma.TransactionClient,
  gateway: PaymentGateway,
  order: SweepOrder,
  attemptId: string,
  sessionId: string,
  closedOrderIds: string[],
): Promise<void> => {
  try {
    const session = await gateway.retrieveSession(sessionId);
    const outcome = sessionOutcomeOf(session.status, session.paymentStatus);

    if (outcome === "paid") {
      await applyPaidEvent(tx, order.id, attemptId, session.paymentIntentId);
      logger.info({
        event: "payment.sweep.paid",
        orderId: order.id,
        paymentId: attemptId,
      });
      return;
    }

    if (outcome === "open") {
      await gateway.expireSession(sessionId);
    }

    const expiry = await applyExpiredEvent(tx, order.id, attemptId);

    if (expiry === "closed") {
      closedOrderIds.push(order.id);
      logClosed(order.id, attemptId);
    }
  } catch (error) {
    logger.warn({
      event: "payment.sweep.failed",
      orderId: order.id,
      paymentId: attemptId,
      reason: describe(error),
    });
  }
};

const sweepOrder = async (
  tx: Prisma.TransactionClient,
  gateway: PaymentGateway | null,
  order: SweepOrder,
  closedOrderIds: string[],
): Promise<void> => {
  const attempt = order.payments[0] ?? null;
  const sessionId = attempt?.providerSessionId ?? null;

  if (gateway === null || attempt === null || sessionId === null) {
    await closeWithoutSession(tx, order, attempt?.id ?? null, closedOrderIds);
    return;
  }

  await sweepWithSession(
    tx,
    gateway,
    order,
    attempt.id,
    sessionId,
    closedOrderIds,
  );
};

const selectOverdueOrders = async (
  tx: Prisma.TransactionClient,
): Promise<SweepOrder[]> =>
  await tx.order.findMany({
    where: {
      paymentMethod: "ONLINE_CARD",
      paymentStatus: { in: ["PENDING", "FAILED"] },
      paymentExpiresAt: { lt: new Date() },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    orderBy: { paymentExpiresAt: "asc" },
    take: PAYMENT_SWEEP_BATCH,
    include: SWEEP_INCLUDE,
  });

export const runPaymentSweep = async (
  gateway: PaymentGateway | null = paymentGateway(),
): Promise<void> => {
  const closedOrderIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(${PAYMENT_SWEEP_LOCK_KEY}::bigint) AS locked
    `;

    if (!lock?.locked) {
      return;
    }

    const orders = await selectOverdueOrders(tx);

    for (const order of orders) {
      await sweepOrder(tx, gateway, order, closedOrderIds);
    }
  }, SWEEP_TRANSACTION_OPTIONS);

  for (const orderId of closedOrderIds) {
    await invalidateStockOfOrder(orderId);
  }
};

export const startPaymentSweep = (): NodeJS.Timeout => {
  const timer = setInterval(() => {
    void runPaymentSweep().catch((error: unknown) => {
      logger.error({
        event: "payment.sweep.crashed",
        reason: describe(error),
      });
    });
  }, PAYMENT_SWEEP_INTERVAL_MS);

  timer.unref();

  return timer;
};
