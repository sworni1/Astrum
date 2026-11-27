import { prisma } from "../../../lib/prisma";
import { logger } from "../../common/helpers/logger";
import { SWEEP_TRANSACTION_OPTIONS } from "../../common/helpers/sweepTransaction";
import {
  GUEST_RETENTION_DAYS,
  GUEST_SWEEP_INTERVAL_MS,
  GUEST_SWEEP_LOCK_KEY,
} from "./constants/guest.constants";

const RETENTION_MS = GUEST_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export type SweepCounts = { cartLines: number; wishlistLines: number };

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
