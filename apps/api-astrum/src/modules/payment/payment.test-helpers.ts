import type { Prisma } from "../../../generated/prisma/client";

export type FakeAttempt = {
  id?: string;
  status?: string;
  providerPaymentIntentId?: string | null;
  currency?: string;
};

export type FakeOrder = {
  id?: string;
  status?: string;
  paymentStatus?: string;
  OrderItem?: Array<{ id: string; productId: string; quantity: number; status: string }>;
};

type FakeTxOptions = {
  order?: FakeOrder;
  attempt?: FakeAttempt;
  /** Rows the conditional attempt update reports as touched. */
  attemptUpdates?: number;
  /** Rows the conditional order payment status update reports as touched. */
  orderUpdates?: number;
};

/**
 * One in memory transaction client for the payment transitions: every writer the
 * apply path uses is a jest mock, so a test asserts the exact write it expects.
 */
export const createFakeTx = (options: FakeTxOptions = {}) => {
  const order = {
    id: "order-1",
    status: "PENDING",
    paymentStatus: "PENDING",
    OrderItem: [
      { id: "line-1", productId: "p-1", quantity: 2, status: "PENDING" },
    ],
    ...options.order,
  };
  const attempt = {
    id: "pay-1",
    status: "PENDING",
    providerPaymentIntentId: null,
    currency: "RUB",
    amount: { toFixed: () => "100.00" },
    ...options.attempt,
  };

  return {
    $queryRaw: jest.fn().mockResolvedValue([{ id: "order-1" }]),
    payment: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(attempt),
      update: jest.fn().mockResolvedValue(attempt),
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: options.attemptUpdates ?? 1 }),
    },
    order: {
      findFirstOrThrow: jest.fn().mockResolvedValue(order),
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: options.orderUpdates ?? 1 }),
      update: jest.fn().mockResolvedValue(order),
    },
    orderItem: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([{ status: "CANCELLED" }]),
    },
    product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
};

export type FakeTx = ReturnType<typeof createFakeTx>;

/** The apply functions take the real Prisma client type; a fake satisfies it at runtime. */
export const asTx = (tx: FakeTx): Prisma.TransactionClient =>
  tx as unknown as Prisma.TransactionClient;

/** The structured log lines a run wrote, parsed back from the console spy calls. */
export const loggedEvents = (spy: jest.SpyInstance): string[] =>
  spy.mock.calls.map((call: unknown[]) => {
    const line = JSON.parse(String(call[0])) as { event?: string };

    return line.event ?? "";
  });
