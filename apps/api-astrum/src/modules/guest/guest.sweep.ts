import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../common/helpers/logger";
import {
  GUEST_RETENTION_DAYS,
  GUEST_SWEEP_INTERVAL_MS,
  GUEST_SWEEP_LOCK_KEY,
} from "./constants/guest.constants";

const RETENTION_MS = GUEST_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const SWEEP_TRANSACTION_OPTIONS = {
  maxWait: 5000,
  timeout: 60_000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
};

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export type SweepCounts = { cartLines: number; wishlistLines: number };

/**
 * One pass behind a transaction scoped advisory lock, so one of the replicas
 * sweeps and a tick is skipped while another holds it. A guest row whose owner
 * never came back dies after the retention bound, the line of a gone product
 * included (spec 0028, AC-16).
 */
export const runGuestSweep = async (
  now: Date = new Date(),
): Promise<SweepCounts> => {
  const cutoff = new Date(now.getTime() - RETENTION_MS);

  let counts: SweepCounts = { cartLines: 0, wishlistLines: 0 };

  await prisma.$transaction(async (tx) => {
    const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(${GUEST_SWEEP_LOCK_KEY}::bigint) AS locked
    `;

    if (!lock?.locked) {
      return;
    }

    const cart = await tx.cartItem.deleteMany({
      where: { guestId: { not: null }, updatedAt: { lt: cutoff } },
    });

    const wishlist = await tx.wishlistItem.deleteMany({
      where: { guestId: { not: null }, updatedAt: { lt: cutoff } },
    });

    counts = { cartLines: cart.count, wishlistLines: wishlist.count };
  }, SWEEP_TRANSACTION_OPTIONS);

  logger.info({ event: "guest.sweep.done", ...counts });

  return counts;
};

/**
 * Started from `server.ts` and never from `app.ts`, so importing the app starts
 * no timer. The boot pass is this sweep's own addition: `payment.sweep` only
 * starts a timer, so it is not copied as a whole (AC-16).
 */
export const startGuestSweep = (): NodeJS.Timeout => {
  void runGuestSweep().catch((error: unknown) => {
    logger.error({
      event: "guest.sweep.crashed",
      reason: describe(error),
    });
  });

  const timer = setInterval(() => {
    void runGuestSweep().catch((error: unknown) => {
      logger.error({
        event: "guest.sweep.crashed",
        reason: describe(error),
      });
    });
  }, GUEST_SWEEP_INTERVAL_MS);

  timer.unref();

  return timer;
};
