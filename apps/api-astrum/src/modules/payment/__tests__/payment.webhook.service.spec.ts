jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    paymentEvent: { create: jest.fn(), update: jest.fn() },
    payment: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    order: { findUnique: jest.fn() },
  },
}));

jest.mock("../payment.dispatch", () => ({
  applyProviderEvent: jest.fn(),
}));

import { prisma } from "../../../../lib/prisma";
import { applyProviderEvent } from "../payment.dispatch";
import type { ProviderEvent } from "../payment.gateway";
import { handleWebhookEvent } from "../payment.webhook.service";

const prismaMock = prisma as unknown as {
  paymentEvent: { create: jest.Mock; update: jest.Mock };
  payment: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  order: { findUnique: jest.Mock };
};

const dispatchMock = applyProviderEvent as jest.Mock;

const order = {
  id: "order-1",
  status: "PENDING",
  paymentStatus: "PENDING",
  grandTotal: "100.00",
  currency: "RUB",
  OrderItem: [],
};

const attempt = {
  id: "pay-1",
  orderId: "order-1",
  status: "PENDING",
  providerSessionId: "cs-1",
  providerPaymentIntentId: null,
  amount: { toFixed: () => "100.00" },
  currency: "RUB",
  order,
};

const paidEvent = (overrides: Partial<ProviderEvent> = {}): ProviderEvent => ({
  id: "evt-1",
  type: "checkout.session.completed",
  sessionId: "cs-1",
  paymentIntentId: "pi-1",
  orderId: "order-1",
  amount: 10000,
  currency: "rub",
  sessionStatus: "complete",
  paymentStatus: "paid",
  declineCode: null,
  errorMessage: null,
  ...overrides,
});

beforeEach(() => {
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  prismaMock.paymentEvent.create.mockReset().mockResolvedValue({ id: "event-1" });
  prismaMock.paymentEvent.update.mockReset().mockResolvedValue({});
  prismaMock.payment.findUnique.mockReset().mockResolvedValue(attempt);
  prismaMock.payment.findFirst.mockReset().mockResolvedValue(null);
  prismaMock.payment.update.mockReset().mockResolvedValue(attempt);
  prismaMock.order.findUnique.mockReset().mockResolvedValue(order);
  dispatchMock.mockReset().mockResolvedValue("applied");
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("handleWebhookEvent", () => {
  it("записывает доставку до применения и метит её applied (AC-5, AC-6)", async () => {
    const outcome = await handleWebhookEvent(paidEvent());

    expect(outcome).toBe("applied");
    expect(prismaMock.paymentEvent.create).toHaveBeenCalledWith({
      data: {
        provider: "STRIPE",
        eventId: "evt-1",
        type: "checkout.session.completed",
        orderId: "order-1",
        sessionId: "cs-1",
        amountTotal: 10000,
        currency: "rub",
        sessionStatus: "complete",
        paymentStatus: "paid",
      },
    });
    expect(prismaMock.paymentEvent.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: { applied: true, paymentId: "pay-1" },
    });
    expect(dispatchMock).toHaveBeenCalledWith(paidEvent(), {
      orderId: "order-1",
      attemptId: "pay-1",
    });
  });

  it("повторная доставка того же event id не применяется и не пишет (AC-5)", async () => {
    prismaMock.paymentEvent.create.mockRejectedValue({ code: "P2002" });

    const outcome = await handleWebhookEvent(paidEvent());

    expect(outcome).toBe("replayed");
    expect(prismaMock.payment.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.paymentEvent.update).not.toHaveBeenCalled();
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("сумма, отличная от grandTotal, ничего не меняет (AC-5)", async () => {
    const outcome = await handleWebhookEvent(paidEvent({ amount: 9900 }));

    expect(outcome).toBe("mismatch");
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(prismaMock.paymentEvent.update).not.toHaveBeenCalled();
  });

  it("валюта, отличная от валюты заказа, ничего не меняет (AC-5)", async () => {
    const outcome = await handleWebhookEvent(paidEvent({ currency: "usd" }));

    expect(outcome).toBe("mismatch");
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("сессию без попытки записывает как unmatched и отвечает без записи состояния (AC-5)", async () => {
    prismaMock.payment.findUnique.mockResolvedValue(null);
    prismaMock.payment.findFirst.mockResolvedValue(null);
    prismaMock.order.findUnique.mockResolvedValue(null);

    const outcome = await handleWebhookEvent(paidEvent({ orderId: null }));

    expect(outcome).toBe("unmatched");
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("усыновляет PENDING попытку по order_id, когда сессия ещё не записана (AC-5)", async () => {
    prismaMock.payment.findUnique.mockResolvedValue(null);
    prismaMock.payment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ ...attempt, providerSessionId: null });

    const outcome = await handleWebhookEvent(paidEvent());

    expect(outcome).toBe("applied");
    expect(prismaMock.payment.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: { providerSessionId: "cs-1" },
    });
  });

  it("событие, которое не изменило состояние, остаётся applied: false (AC-5)", async () => {
    dispatchMock.mockResolvedValue("ignored");

    const outcome = await handleWebhookEvent(paidEvent());

    expect(outcome).toBe("ignored");
    expect(prismaMock.paymentEvent.update).not.toHaveBeenCalled();
  });
});
