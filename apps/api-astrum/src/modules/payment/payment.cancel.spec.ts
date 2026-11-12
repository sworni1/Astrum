jest.mock("./payment.gateway.registry", () => ({ paymentGateway: jest.fn() }));

jest.mock("./payment.attempts", () => ({ newestOpenAttempt: jest.fn() }));

import { newestOpenAttempt } from "./payment.attempts";
import { expireSessionForCancel } from "./payment.cancel";
import type { PaymentGateway } from "./payment.gateway";
import { paymentGateway } from "./payment.gateway.registry";
import { loggedEvents } from "./payment.test-helpers";

const gatewayMock = paymentGateway as jest.Mock;
const attemptMock = newestOpenAttempt as jest.Mock;

const gateway = (): PaymentGateway => ({
  createSession: jest.fn(),
  retrieveSession: jest.fn(),
  expireSession: jest.fn().mockResolvedValue(undefined),
  constructEvent: jest.fn(),
});

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  gatewayMock.mockReset();
  attemptMock.mockReset().mockResolvedValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("expireSessionForCancel", () => {
  it("гасит сессию провайдера до открытия транзакции отмены (AC-11)", async () => {
    const provider = gateway();

    gatewayMock.mockReturnValue(provider);
    attemptMock.mockResolvedValue({
      id: "pay-1",
      status: "PENDING",
      providerSessionId: "cs-1",
    });

    await expireSessionForCancel("order-1");

    expect(provider.expireSession).toHaveBeenCalledWith("cs-1");
  });

  it("не зовёт провайдера без настроенных ключей (AC-11)", async () => {
    gatewayMock.mockReturnValue(null);

    await expireSessionForCancel("order-1");

    expect(attemptMock).not.toHaveBeenCalled();
  });

  it("не зовёт провайдера, когда у попытки нет session id (AC-11)", async () => {
    const provider = gateway();

    gatewayMock.mockReturnValue(provider);
    attemptMock.mockResolvedValue({
      id: "pay-1",
      status: "PENDING",
      providerSessionId: null,
    });

    await expireSessionForCancel("order-1");

    expect(provider.expireSession).not.toHaveBeenCalled();
  });

  it("ошибка гашения логируется и не блокирует отмену (AC-11)", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const provider = gateway();

    provider.expireSession = jest.fn().mockRejectedValue(new Error("gone"));
    gatewayMock.mockReturnValue(provider);
    attemptMock.mockResolvedValue({
      id: "pay-1",
      status: "PENDING",
      providerSessionId: "cs-1",
    });

    await expect(expireSessionForCancel("order-1")).resolves.toBeUndefined();
    expect(loggedEvents(warn)).toContain("payment.cancel.expire_failed");
  });
});
