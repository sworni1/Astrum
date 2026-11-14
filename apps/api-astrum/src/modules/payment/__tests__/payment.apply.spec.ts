import {
  applyAsyncFailedEvent,
  applyDeclinedEvent,
  applyExpiredEvent,
  applyPaidEvent,
  amountMatchesOrder,
} from "../payment.apply";
import { asTx, createFakeTx, loggedEvents } from "../payment.test-helpers";

const silenceLogs = () => {
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe("amountMatchesOrder", () => {
  const order = { grandTotal: "100.00", currency: "RUB" } as never;

  it("сверяет сумму в минорных единицах и валюту без регистра (AC-5)", () => {
    expect(amountMatchesOrder(order, 10000, "rub")).toBe(true);
  });

  it("не совпадает при другой сумме или валюте (AC-5)", () => {
    expect(amountMatchesOrder(order, 9999, "rub")).toBe(false);
    expect(amountMatchesOrder(order, 10000, "usd")).toBe(false);
    expect(amountMatchesOrder(order, null, "rub")).toBe(false);
  });
});

describe("applyPaidEvent", () => {
  it("переводит попытку и заказ в PAID, подтверждает ждущие строки и пишет paidAt (AC-2)", async () => {
    const info = jest
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const tx = createFakeTx();
    tx.orderItem.findMany.mockResolvedValue([{ status: "CONFIRMED" }]);

    const result = await applyPaidEvent(asTx(tx), "order-1", "pay-1", "pi-1");

    expect(result).toBe("applied");
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: {
        status: "PAID",
        paidAt: expect.any(Date),
        providerPaymentIntentId: "pi-1",
      },
    });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: "order-1",
        paymentStatus: { in: ["PENDING", "FAILED", "CANCELLED"] },
      },
      data: { paymentStatus: "PAID" },
    });
    expect(tx.orderItem.updateMany).toHaveBeenCalledWith({
      where: { orderId: "order-1", status: "PENDING" },
      data: { status: "CONFIRMED" },
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "CONFIRMED" },
    });
    expect(loggedEvents(info)).toContain("payment.lines_confirmed");
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it("вторая доставка по уже оплаченной попытке ничего не меняет (AC-4)", async () => {
    const info = jest
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const tx = createFakeTx({ attempt: { status: "PAID" } });

    const result = await applyPaidEvent(asTx(tx), "order-1", "pay-1", "pi-1");

    expect(result).toBe("ignored");
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
    expect(loggedEvents(info)).not.toContain("payment.lines_confirmed");
  });

  it("синхронизация по старой попытке оплаченного заказа ничего не пишет (AC-4)", async () => {
    const info = jest
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const tx = createFakeTx({
      attempt: { status: "FAILED" },
      order: { paymentStatus: "PAID" },
    });

    const result = await applyPaidEvent(asTx(tx), "order-1", "pay-1", null);

    expect(result).toBe("ignored");
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
    expect(loggedEvents(info)).not.toContain("payment.lines_confirmed");
  });

  it("подтверждает только ждущие строки и не трогает отменённую (AC-3)", async () => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const tx = createFakeTx();
    tx.orderItem.findMany.mockResolvedValue([
      { status: "CONFIRMED" },
      { status: "CANCELLED" },
    ]);

    const result = await applyPaidEvent(asTx(tx), "order-1", "pay-1", "pi-1");

    expect(result).toBe("applied");
    expect(tx.orderItem.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.orderItem.updateMany.mock.calls[0][0].where.status).toBe(
      "PENDING",
    );
    expect(loggedEvents(warn)).not.toContain("payment.refund_owed");
  });

  it("оплата после отмены помечает PAID и просит возврат (AC-3)", async () => {
    const warn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    const tx = createFakeTx({
      attempt: { status: "CANCELLED" },
      order: { status: "CANCELED", paymentStatus: "CANCELLED" },
    });
    tx.orderItem.findMany.mockResolvedValue([{ status: "CANCELLED" }]);

    const result = await applyPaidEvent(asTx(tx), "order-1", "pay-1", null);

    expect(result).toBe("applied");
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: { status: "PAID", paidAt: expect.any(Date) },
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "CANCELED" },
    });
    expect(loggedEvents(warn)).toContain("payment.refund_owed");
    expect(JSON.parse(String(warn.mock.calls[0][0]))).toMatchObject({
      event: "payment.refund_owed",
      orderId: "order-1",
      paymentId: "pay-1",
      reason: "late_payment",
      amount: "100.00",
      currency: "RUB",
    });
  });
});

describe("applyExpiredEvent", () => {
  it("закрывает нетронутый заказ и возвращает остаток (AC-8)", async () => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const tx = createFakeTx();

    const result = await applyExpiredEvent(asTx(tx), "order-1", "pay-1");

    expect(result).toBe("closed");
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay-1", status: { in: ["PENDING", "FAILED"] } },
      data: { status: "EXPIRED" },
    });
    expect(tx.orderItem.updateMany).toHaveBeenCalledWith({
      where: { orderId: "order-1", status: { in: ["PENDING", "CONFIRMED"] } },
      data: { status: "CANCELLED" },
    });
    expect(tx.product.updateMany).toHaveBeenCalledTimes(1);
  });

  it("повторная доставка не возвращает остаток второй раз (AC-8)", async () => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    const tx = createFakeTx({ attemptUpdates: 0 });

    const result = await applyExpiredEvent(asTx(tx), "order-1", "pay-1");

    expect(result).toBe("unchanged");
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
  });

  it("заказ, принятый продавцом, остаётся открытым и склад не двигается (AC-8)", async () => {
    const warn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    const tx = createFakeTx({ order: { status: "CONFIRMED" } });

    const result = await applyExpiredEvent(asTx(tx), "order-1", "pay-1");

    expect(result).toBe("seller");
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
    expect(loggedEvents(warn)).toContain("payment.expired_after_seller_action");
  });
});

describe("applyDeclinedEvent", () => {
  it("хранит причину отказа, оставляет попытку PENDING и метит заказ FAILED (AC-7)", async () => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    const tx = createFakeTx();

    const result = await applyDeclinedEvent(asTx(tx), "order-1", "pay-1", {
      code: "insufficient_funds",
      message: "  Your card was declined.  ",
    });

    expect(result).toBe("applied");
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: {
        lastErrorCode: "insufficient_funds",
        lastErrorMessage: "  Your card was declined.  ",
      },
    });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", paymentStatus: { in: ["PENDING"] } },
      data: { paymentStatus: "FAILED" },
    });
  });

  it("без кода отказа пишет фиксированный unknown (AC-7)", async () => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    const tx = createFakeTx();

    await applyDeclinedEvent(asTx(tx), "order-1", "pay-1", {
      code: null,
      message: null,
    });

    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: { lastErrorCode: "unknown", lastErrorMessage: null },
    });
  });
});

describe("applyAsyncFailedEvent", () => {
  it("закрывает попытку как FAILED и склад не возвращает (AC-7)", async () => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    const tx = createFakeTx();

    const result = await applyAsyncFailedEvent(asTx(tx), "order-1", "pay-1");

    expect(result).toBe("applied");
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay-1", status: "PENDING" },
      data: { status: "FAILED" },
    });
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });
});
