jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    order: { findFirst: jest.fn(), findFirstOrThrow: jest.fn() },
    payment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock("../payment.dispatch", () => ({
  applySession: jest.fn(),
  inTransaction: jest.fn(),
}));

jest.mock("../payment.apply", () => ({ applyExpiredEvent: jest.fn() }));

import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../../common/helpers/appError";
import { applyExpiredEvent } from "../payment.apply";
import { applySession, inTransaction } from "../payment.dispatch";
import type { PaymentGateway, ProviderSession } from "../payment.gateway";
import { IdempotencyKeyReusedError } from "../payment.gateway";
import { PaymentService } from "../payment.service";

const prismaMock = prisma as unknown as {
  order: { findFirst: jest.Mock; findFirstOrThrow: jest.Mock };
  payment: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
};

const sessionMock = applySession as jest.Mock;
const expiredMock = applyExpiredEvent as jest.Mock;
const transactionMock = inTransaction as jest.Mock;

const future = new Date(Date.now() + 30 * 60_000);

const order = (overrides: Record<string, unknown> = {}) => ({
  id: "order-1",
  userId: "user-1",
  status: "PENDING",
  paymentStatus: "PENDING",
  paymentMethod: "ONLINE_CARD",
  paymentExpiresAt: future,
  grandTotal: "100.00",
  currency: "RUB",
  OrderItem: [],
  ...overrides,
});

const gateway = (overrides: Partial<PaymentGateway> = {}): PaymentGateway => ({
  createSession: jest.fn().mockResolvedValue({
    sessionId: "cs-1",
    url: "https://pay.stripe.test/cs-1",
  }),
  retrieveSession: jest.fn(),
  expireSession: jest.fn(),
  constructEvent: jest.fn(),
  ...overrides,
});

const session = (overrides: Partial<ProviderSession> = {}): ProviderSession => ({
  id: "cs-1",
  status: "complete",
  paymentStatus: "paid",
  amountTotal: 10000,
  currency: "rub",
  paymentIntentId: "pi-1",
  orderId: "order-1",
  ...overrides,
});

beforeEach(() => {
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  prismaMock.order.findFirst.mockReset().mockResolvedValue(order());
  prismaMock.order.findFirstOrThrow.mockReset().mockResolvedValue({
    paymentStatus: "PAID",
    status: "PENDING",
    paymentExpiresAt: future,
  });
  prismaMock.payment.findFirst.mockReset().mockResolvedValue(null);
  prismaMock.payment.create.mockReset().mockResolvedValue({
    id: "pay-1",
    orderId: "order-1",
    status: "PENDING",
    checkoutUrl: null,
  });
  prismaMock.payment.update.mockReset().mockResolvedValue({});
  prismaMock.payment.updateMany.mockReset().mockResolvedValue({ count: 1 });
  sessionMock.mockReset().mockResolvedValue("applied");
  expiredMock.mockReset().mockResolvedValue("closed");
  transactionMock.mockImplementation(async (work: (tx: unknown) => unknown) =>
    work({
      payment: { update: jest.fn() },
      order: { update: jest.fn() },
    }),
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

const refusal = async (promise: Promise<unknown>): Promise<AppError> =>
  (await promise.catch((error: AppError) => error)) as AppError;

describe("PaymentService.startPayment", () => {
  it("отказывает чужому заказу с 404 ORDER_NOT_FOUND (AC-4)", async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);
    const service = new PaymentService(() => gateway());

    const error = await refusal(service.startPayment("order-9", "user-1"));

    expect(error.status).toBe(404);
    expect(error.code).toBe("ORDER_NOT_FOUND");
  });

  it("отказывает заказу не с онлайн картой с 409 ORDER_NOT_PAYABLE (AC-4)", async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      order({ paymentMethod: "CASH" }),
    );
    const service = new PaymentService(() => gateway());

    const error = await refusal(service.startPayment("order-1", "user-1"));

    expect(error.status).toBe(409);
    expect(error.code).toBe("ORDER_NOT_PAYABLE");
  });

  it("отказывает оплаченному заказу с 409 PAYMENT_ALREADY_PAID (AC-4)", async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      order({ paymentStatus: "PAID" }),
    );
    const service = new PaymentService(() => gateway());

    const error = await refusal(service.startPayment("order-1", "user-1"));

    expect(error.status).toBe(409);
    expect(error.code).toBe("PAYMENT_ALREADY_PAID");
  });

  it("истёкшее окно закрывает заказ и отвечает 409 PAYMENT_WINDOW_EXPIRED (AC-4, AC-8)", async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      order({ paymentExpiresAt: new Date(Date.now() - 60_000) }),
    );
    prismaMock.payment.findFirst.mockResolvedValue({ id: "pay-1" });
    const service = new PaymentService(() => gateway());

    const error = await refusal(service.startPayment("order-1", "user-1"));

    expect(error.status).toBe(409);
    expect(error.code).toBe("PAYMENT_WINDOW_EXPIRED");
    expect(expiredMock).toHaveBeenCalledWith(expect.anything(), "order-1", "pay-1");
  });

  it("повторное нажатие отдаёт сохранённый адрес и не зовёт провайдера (AC-4)", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      id: "pay-1",
      status: "PENDING",
      checkoutUrl: "https://pay.stripe.test/paid",
      expiresAt: future,
    });
    const provider = gateway();
    const service = new PaymentService(() => provider);

    const result = await service.startPayment("order-1", "user-1");

    expect(result).toEqual({
      url: "https://pay.stripe.test/paid",
      expiresAt: future,
      created: false,
    });
    expect(provider.createSession).not.toHaveBeenCalled();
  });

  it("без ключей провайдера отвечает 502 PAYMENT_PROVIDER_UNAVAILABLE (AC-1)", async () => {
    const service = new PaymentService(() => null);

    const error = await refusal(service.startPayment("order-1", "user-1"));

    expect(error.status).toBe(502);
    expect(error.code).toBe("PAYMENT_PROVIDER_UNAVAILABLE");
  });

  it("ошибка провайдера оставляет попытку пригодной для повтора (AC-4)", async () => {
    const provider = gateway({
      createSession: jest.fn().mockRejectedValue(new Error("stripe down")),
    });
    const service = new PaymentService(() => provider);

    const error = await refusal(service.startPayment("order-1", "user-1"));

    expect(error.status).toBe(502);
    expect(prismaMock.payment.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.payment.update).not.toHaveBeenCalled();
  });

  it("перевыпускает попытку, если провайдер отказал уже сожжённому ключу (AC-4)", async () => {
    const createSession = jest
      .fn()
      .mockRejectedValueOnce(new IdempotencyKeyReusedError("pay-1"))
      .mockResolvedValueOnce({
        sessionId: "cs-2",
        url: "https://pay.stripe.test/cs-2",
      });
    prismaMock.payment.create
      .mockReset()
      .mockResolvedValueOnce({
        id: "pay-1",
        orderId: "order-1",
        status: "PENDING",
        checkoutUrl: null,
      })
      .mockResolvedValueOnce({
        id: "pay-2",
        orderId: "order-1",
        status: "PENDING",
        checkoutUrl: null,
      });
    const service = new PaymentService(() => gateway({ createSession }));

    const result = await service.startPayment("order-1", "user-1");

    expect(result.url).toBe("https://pay.stripe.test/cs-2");
    expect(result.created).toBe(true);
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay-1", status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    expect(createSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ attemptId: "pay-2" }),
    );
    expect(prismaMock.payment.update).toHaveBeenCalledWith({
      where: { id: "pay-2" },
      data: { providerSessionId: "cs-2", checkoutUrl: "https://pay.stripe.test/cs-2" },
    });
  });

  it("не зацикливается, если провайдер отказывает ключу дважды (AC-4)", async () => {
    const createSession = jest
      .fn()
      .mockRejectedValue(new IdempotencyKeyReusedError("pay-1"));
    const service = new PaymentService(() => gateway({ createSession }));

    const error = await refusal(service.startPayment("order-1", "user-1"));

    expect(error.status).toBe(502);
    expect(error.code).toBe("PAYMENT_PROVIDER_UNAVAILABLE");
    expect(createSession).toHaveBeenCalledTimes(2);
  });

  it("создаёт сессию с суммой в минорных единицах и обоими адресами возврата (AC-4, AC-14)", async () => {
    const provider = gateway();
    const service = new PaymentService(() => provider);

    const result = await service.startPayment("order-1", "user-1");

    expect(result.created).toBe(true);
    expect(provider.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId: "pay-1",
        orderId: "order-1",
        amountMinor: 10000,
        currency: "RUB",
        successUrl: expect.stringContaining("/orders/order-1?payment=return"),
        cancelUrl: expect.stringContaining("/orders/order-1?payment=cancelled"),
      }),
    );
    expect(prismaMock.payment.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: {
        providerSessionId: "cs-1",
        checkoutUrl: "https://pay.stripe.test/cs-1",
      },
    });
  });
});

describe("PaymentService.syncPayment", () => {
  it("без попытки отвечает текущим статусом и не зовёт провайдера (AC-10)", async () => {
    const provider = gateway();
    const service = new PaymentService(() => provider);

    const result = await service.syncPayment("order-1", "user-1");

    expect(result).toEqual({
      paymentStatus: "PAID",
      status: "PENDING",
      paymentExpiresAt: future,
    });
    expect(provider.retrieveSession).not.toHaveBeenCalled();
  });

  it("применяет полученную сессию тем же путём, что и webhook (AC-10)", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      id: "pay-1",
      status: "PENDING",
      providerSessionId: "cs-1",
    });
    const provider = gateway({
      retrieveSession: jest.fn().mockResolvedValue(session()),
    });
    const service = new PaymentService(() => provider);

    await service.syncPayment("order-1", "user-1");

    expect(sessionMock).toHaveBeenCalledWith(session(), {
      orderId: "order-1",
      attemptId: "pay-1",
    });
  });

  it("недоступный провайдер отвечает 502 (AC-10)", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      id: "pay-1",
      status: "PENDING",
      providerSessionId: "cs-1",
    });
    const provider = gateway({
      retrieveSession: jest.fn().mockRejectedValue(new Error("timeout")),
    });
    const service = new PaymentService(() => provider);

    const error = await refusal(service.syncPayment("order-1", "user-1"));

    expect(error.status).toBe(502);
    expect(error.code).toBe("PAYMENT_PROVIDER_UNAVAILABLE");
  });
});
