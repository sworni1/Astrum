jest.mock("../../../../lib/prisma", () => ({
  prisma: { $transaction: jest.fn() },
}));
jest.mock("../../../common/helpers/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma } from "../../../../lib/prisma";
import { logger } from "../../../common/helpers/logger";
import { GUEST_RETENTION_DAYS } from "../constants/guest.constants";
import { runGuestSweep } from "../guest.sweep";

type Row = { guestId: string | null; updatedAt: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

/** A table that really deletes, so the test reads the surviving rows. */
const table = (rows: Row[]) => ({
  deleteMany: jest.fn(async ({ where }: { where: { updatedAt: { lt: Date } } }) => {
    const before = rows.length;
    const survivors = rows.filter(
      (row) => !(row.updatedAt < where.updatedAt.lt && row.guestId !== null),
    );

    rows.length = 0;
    rows.push(...survivors);

    return { count: before - survivors.length };
  }),
});

const NOW = new Date("2026-11-18T12:00:00.000Z");

describe("runGuestSweep", () => {
  beforeEach(() => jest.clearAllMocks());

  it("deletes a row touched 31 days ago and keeps one touched 29 days ago (AC-16)", async () => {
    const cartRows: Row[] = [
      { guestId: "old", updatedAt: new Date(NOW.getTime() - 31 * DAY_MS) },
      { guestId: "fresh", updatedAt: new Date(NOW.getTime() - 29 * DAY_MS) },
      { guestId: null, updatedAt: new Date(NOW.getTime() - 90 * DAY_MS) },
    ];
    const wishRows: Row[] = [
      { guestId: "old", updatedAt: new Date(NOW.getTime() - 31 * DAY_MS) },
    ];

    const tx = {
      $queryRaw: jest.fn(async () => [{ locked: true }]),
      cartItem: table(cartRows),
      wishlistItem: table(wishRows),
    };

    (prisma as unknown as { $transaction: jest.Mock }).$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const counts = await runGuestSweep(NOW);

    expect(counts).toEqual({ cartLines: 1, wishlistLines: 1 });
    // The account row is never a candidate, however old it is.
    expect(cartRows.map((row) => row.guestId)).toEqual(["fresh", null]);
    expect(logger.info).toHaveBeenCalledWith({
      event: "guest.sweep.done",
      cartLines: 1,
      wishlistLines: 1,
    });
  });

  it("asks for the retention bound the cookie uses (AC-16)", async () => {
    const cartRows: Row[] = [];
    const tx = {
      $queryRaw: jest.fn(async () => [{ locked: true }]),
      cartItem: table(cartRows),
      wishlistItem: table([]),
    };
    let cutoff: Date | undefined;

    tx.cartItem.deleteMany.mockImplementation(async ({ where }: { where: { updatedAt: { lt: Date } } }) => {
      cutoff = where.updatedAt.lt;
      return { count: 0 };
    });

    (prisma as unknown as { $transaction: jest.Mock }).$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    await runGuestSweep(NOW);

    expect(cutoff?.toISOString()).toBe(
      new Date(NOW.getTime() - GUEST_RETENTION_DAYS * DAY_MS).toISOString(),
    );
  });

  it("skips the pass while another replica holds the lock (AC-16)", async () => {
    const tx = {
      $queryRaw: jest.fn(async () => [{ locked: false }]),
      cartItem: table([]),
      wishlistItem: table([]),
    };

    (prisma as unknown as { $transaction: jest.Mock }).$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    await expect(runGuestSweep(NOW)).resolves.toEqual({
      cartLines: 0,
      wishlistLines: 0,
    });
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
  });
});
