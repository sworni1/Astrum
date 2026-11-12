import { Prisma } from "../../../generated/prisma/client";
import type { PaymentAttemptStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../common/helpers/logger";
import { applyExpiredEvent, applyPaidEvent } from "./payment.apply";
import {
  PAYMENT_SWEEP_BATCH,
  PAYMENT_SWEEP_INTERVAL_MS,
  PAYMENT_SWEEP_LOCK_KEY,
} from "./payment.constants";
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

/** A network call per order sits inside this transaction, so it needs room. */
const SWEEP_TRANSACTION_OPTIONS = {
  maxWait: 5000,
  timeout: 60_000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
};

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const logClosed = (orderId: string, paymentId: string): void => {
  logger.info({ event: "payment.sweep.closed", orderId, paymentId });
};

const closeWithoutSession = async (
  tx: Prisma.TransactionClient,
  order: SweepOrder,
  attemptId: string | null,
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
    logClosed(order.id, attemptId);
  }
};

/**
 * The provider session decides on its own: paid applies the paid transition, an
 * expired one the close, and a session still open past its deadline is expired
 * here first. A provider fault leaves the order for the next tick (AC-9).
 */
const sweepWithSession = async (
  tx: Prisma.TransactionClient,
  gateway: PaymentGateway,
  order: SweepOrder,
  attemptId: string,
  sessionId: string,
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
): Promise<void> => {
  const attempt = order.payments[0] ?? null;
  const sessionId = attempt?.providerSessionId ?? null;

  if (gateway === null || attempt === null || sessionId === null) {
    await closeWithoutSession(tx, order, attempt?.id ?? null);
    return;
  }

  await sweepWithSession(tx, gateway, order, attempt.id, sessionId);
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

/**
 * One pass, behind a transaction scoped advisory lock so one replica sweeps and
 * a tick is skipped while another holds it (AC-9). A session level lock would
 * outlive its pooled connection.
 */
export const runPaymentSweep = async (
  gateway: PaymentGateway | null = paymentGateway(),
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(${PAYMENT_SWEEP_LOCK_KEY}::bigint) AS locked
    `;

    if (!lock?.locked) {
      return;
    }

    const orders = await selectOverdueOrders(tx);

    for (const order of orders) {
      await sweepOrder(tx, gateway, order);
    }
  }, SWEEP_TRANSACTION_OPTIONS);
};

/** Started from `server.ts` and never from `app.ts` (AC-9). */
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
