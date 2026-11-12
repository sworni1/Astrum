jest.mock("./payment.gateway.registry", () => ({ paymentGateway: jest.fn() }));

jest.mock("./payment.webhook.service", () => ({ handleWebhookEvent: jest.fn() }));

import type { Request, Response } from "express";
import { InvalidSignatureError, type PaymentGateway } from "./payment.gateway";
import { paymentGateway } from "./payment.gateway.registry";
import { handleStripeWebhook } from "./payment.webhook.controller";
import { handleWebhookEvent } from "./payment.webhook.service";

const gatewayMock = paymentGateway as jest.Mock;
const handleMock = handleWebhookEvent as jest.Mock;

const response = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };

  res.status.mockReturnValue(res);

  return res as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
};

const request = (signature: string | null = "t=1,v1=abc") =>
  ({
    headers: signature === null ? {} : { "stripe-signature": signature },
    body: Buffer.from("{}"),
  }) as unknown as Request;

const gateway = (overrides: Partial<PaymentGateway> = {}): PaymentGateway => ({
  createSession: jest.fn(),
  retrieveSession: jest.fn(),
  expireSession: jest.fn(),
  constructEvent: jest.fn().mockReturnValue({
    id: "evt-1",
    type: "checkout.session.completed",
  }),
  ...overrides,
});

beforeEach(() => {
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  gatewayMock.mockReset().mockReturnValue(gateway());
  handleMock.mockReset().mockResolvedValue("applied");
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("handleStripeWebhook", () => {
  it("без ключей провайдера отвечает 503 и ничего не пишет (AC-1)", async () => {
    gatewayMock.mockReturnValue(null);
    const res = response();

    await handleStripeWebhook(request(), res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "PAYMENT_PROVIDER_UNAVAILABLE" }),
    );
    expect(handleMock).not.toHaveBeenCalled();
  });

  it("без подписи отвечает 400 PAYMENT_INVALID_SIGNATURE и ничего не пишет (AC-5)", async () => {
    const res = response();

    await handleStripeWebhook(request(null), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "PAYMENT_INVALID_SIGNATURE" }),
    );
    expect(handleMock).not.toHaveBeenCalled();
  });

  it("неверная подпись отвечает 400 и не доходит до базы (AC-5)", async () => {
    gatewayMock.mockReturnValue(
      gateway({
        constructEvent: jest.fn(() => {
          throw new InvalidSignatureError();
        }),
      }),
    );
    const res = response();

    await handleStripeWebhook(request(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(handleMock).not.toHaveBeenCalled();
  });

  it("неподдерживаемый тип события отвечает 200 и не пишет (AC-5)", async () => {
    gatewayMock.mockReturnValue(
      gateway({
        constructEvent: jest.fn().mockReturnValue({
          id: "evt-2",
          type: "customer.created",
        }),
      }),
    );
    const res = response();

    await handleStripeWebhook(request(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(handleMock).not.toHaveBeenCalled();
  });

  it("проверенное событие применяется и отвечает 200 (AC-5)", async () => {
    const res = response();

    await handleStripeWebhook(request(), res);

    expect(handleMock).toHaveBeenCalledWith({
      id: "evt-1",
      type: "checkout.session.completed",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});
