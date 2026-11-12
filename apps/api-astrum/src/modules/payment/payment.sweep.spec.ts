jest.mock("../../../lib/prisma", () => ({
  prisma: { $transaction: jest.fn() },
}));

jest.mock("./payment.apply", () => ({
  applyPaidEvent: jest.fn(),
  applyExpiredEvent: jest.fn(),
}));

import { prisma } from "../../../lib/prisma";
import { applyExpiredEvent, applyPaidEvent } from "./payment.apply";
import type { PaymentGateway } from "./payment.gateway";
import { runPaymentSweep } from "./payment.sweep";
import { loggedEvents } from "./payment.test-helpers";

const prismaMock = prisma as unknown as { $transaction: jest.Mock };
const paidMock = applyPaidEvent as jest.Mock;
const expiredMock = applyExpiredEvent as jest.Mock;

const tx = () => ({
  $queryRaw: jest.fn(),
  order: { findMany: jest.fn() },
});

const order = (
  overrides: Record<string, unknown> = {},
  attempts: Array<Record<string, unknown>> = [
    { id: "pay-1", providerSessionId: "cs-1", status: "PENDING" },
  ],
) => ({
  id: "order-1",
  status: "PENDING",
  paymentStatus: "PENDING",
  paymentMethod: "ONLINE_CARD",
  paymentExpiresAt: new Date(Date.now() - 60_000),
  grandTotal: "100.00",
  currency: "RUB",
  payments: attempts,
  ...overrides,
});

const gateway = (overrides: Partial<PaymentGateway> = {}): PaymentGateway => ({
  createSession: jest.fn(),
  retrieveSession: jest.fn(),
  expireSession: jest.fn().mockResolvedValue(undefined),
  constructEvent: jest.fn(),
  ...overrides,
});

const wire = (
  orders: unknown[],
  locked = true,
): ReturnType<typeof tx> => {
  const client = tx();

  client.$queryRaw.mockResolvedValue([{ locked }]);
  client.order.findMany.mockResolvedValue(orders);
  prismaMock.$transaction.mockImplementation(
    (work: (inner: typeof client) => unknown) => work(client),
  );

  return client;
};

beforeEach(() => {
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  prismaMock.$transaction.mockReset();
  paidMock.mockReset().mockResolvedValue("applied");
  expiredMock.mockReset().mockResolvedValue("closed");
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("runPaymentSweep", () => {
  it("пропускает такт, пока блокировку держит другая реплика (AC-9)", async () => {
    const client = wire([order()], false);

    await runPaymentSweep(gateway());

    expect(client.order.findMany).not.toHaveBeenCalled();
  });

  it("берёт не больше 20 заказов с истёкшим окном, начиная с самого старого (AC-9)", async () => {
    const client = wire([]);

    await runPaymentSweep(gateway());

    expect(client.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          paymentMethod: "ONLINE_CARD",
          paymentStatus: { in: ["PENDING", "FAILED"] },
          paymentExpiresAt: { lt: expect.any(Date) },
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        orderBy: { paymentExpiresAt: "asc" },
        take: 20,
      }),
    );
  });

  it("применяет оплаченную сессию, которую пропустил webhook (AC-9)", async () => {
    wire([order()]);
    const provider = gateway({
      retrieveSession: jest.fn().mockResolvedValue({
        id: "cs-1",
        status: "complete",
        paymentStatus: "paid",
        amountTotal: 10000,
        currency: "rub",
        paymentIntentId: "pi-1",
        orderId: "order-1",
      }),
    });
    const info = jest.spyOn(console, "info").mockImplementation(() => undefined);

    await runPaymentSweep(provider);

    expect(paidMock).toHaveBeenCalledWith(expect.anything(), "order-1", "pay-1", "pi-1");
    expect(expiredMock).not.toHaveBeenCalled();
    expect(loggedEvents(info)).toContain("payment.sweep.paid");
  });

  it("закрывает нетронутый заказ и пишет payment.sweep.closed (AC-9)", async () => {
    wire([
      order({}, [{ id: "pay-1", providerSessionId: "cs-1", status: "PENDING" }]),
    ]);
    const provider = gateway({
      retrieveSession: jest.fn().mockResolvedValue({
        id: "cs-1",
        status: "expired",
        paymentStatus: "unpaid",
        amountTotal: 10000,
        currency: "rub",
        paymentIntentId: null,
        orderId: "order-1",
      }),
    });
    const info = jest.spyOn(console, "info").mockImplementation(() => undefined);

    await runPaymentSweep(provider);

    expect(expiredMock).toHaveBeenCalledWith(expect.anything(), "order-1", "pay-1");
    expect(loggedEvents(info)).toContain("payment.sweep.closed");
  });

  it("истекает ещё открытую сессию перед закрытием заказа (AC-9)", async () => {
    wire([order()]);
    const provider = gateway({
      retrieveSession: jest.fn().mockResolvedValue({
        id: "cs-1",
        status: "open",
        paymentStatus: "unpaid",
        amountTotal: 10000,
        currency: "rub",
        paymentIntentId: null,
        orderId: "order-1",
      }),
    });

    await runPaymentSweep(provider);

    expect(provider.expireSession).toHaveBeenCalledWith("cs-1");
    expect(expiredMock).toHaveBeenCalledWith(expect.anything(), "order-1", "pay-1");
  });

  it("не отменяет заказ, который продавец уже принял (AC-9)", async () => {
    wire([order({ status: "CONFIRMED" })]);
    expiredMock.mockResolvedValue("seller");
    const provider = gateway({
      retrieveSession: jest.fn().mockResolvedValue({
        id: "cs-1",
        status: "expired",
        paymentStatus: "unpaid",
        amountTotal: 10000,
        currency: "rub",
        paymentIntentId: null,
        orderId: "order-1",
      }),
    });

    await runPaymentSweep(provider);

    expect(expiredMock).toHaveBeenCalledTimes(1);
    expect(provider.expireSession).not.toHaveBeenCalled();
  });

  it("попытка без session id закрывается сразу, без обращения к провайдеру (AC-9)", async () => {
    wire([order({}, [{ id: "pay-1", providerSessionId: null, status: "PENDING" }])]);
    const provider = gateway();

    await runPaymentSweep(provider);

    expect(provider.retrieveSession).not.toHaveBeenCalled();
    expect(expiredMock).toHaveBeenCalledWith(expect.anything(), "order-1", "pay-1");
  });

  it("ошибка провайдера оставляет заказ следующему такту (AC-9)", async () => {
    wire([order()]);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const provider = gateway({
      retrieveSession: jest.fn().mockRejectedValue(new Error("stripe down")),
    });

    await runPaymentSweep(provider);

    expect(expiredMock).not.toHaveBeenCalled();
    expect(paidMock).not.toHaveBeenCalled();
    expect(loggedEvents(warn)).toContain("payment.sweep.failed");
  });
});
