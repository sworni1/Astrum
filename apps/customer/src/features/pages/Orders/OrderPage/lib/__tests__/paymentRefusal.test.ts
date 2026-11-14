import axios, { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { paymentRefusal } from "@/features/pages/Orders/OrderPage/lib/paymentRefusal";

const answered = (status: number, body: unknown): AxiosError =>
  new AxiosError("refused", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    data: body,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

describe("paymentRefusal", () => {
  it("переводит каждый код маршрута оплаты в свою копию (AC-13, AC-15)", () => {
    expect(
      paymentRefusal(answered(409, { code: "ORDER_NOT_PAYABLE" })).key,
    ).toBe("notPayable");
    expect(
      paymentRefusal(answered(409, { code: "PAYMENT_ALREADY_PAID" })).key,
    ).toBe("alreadyPaid");
    expect(
      paymentRefusal(answered(409, { code: "PAYMENT_WINDOW_EXPIRED" })).key,
    ).toBe("windowExpired");
    expect(
      paymentRefusal(answered(502, { code: "PAYMENT_PROVIDER_UNAVAILABLE" }))
        .key,
    ).toBe("providerUnavailable");
    expect(paymentRefusal(answered(404, { code: "ORDER_NOT_FOUND" })).key).toBe(
      "failed",
    );
  });

  it("просит перечитать заказ только при истёкшем окне (AC-13)", () => {
    expect(
      paymentRefusal(answered(409, { code: "PAYMENT_WINDOW_EXPIRED" }))
        .revalidate,
    ).toBe(true);
    expect(
      paymentRefusal(answered(409, { code: "PAYMENT_ALREADY_PAID" }))
        .revalidate,
    ).toBe(false);
  });

  it("незнакомый код и запрос без ответа дают общую копию (AC-15)", () => {
    expect(paymentRefusal(answered(409, { code: "SOMETHING_NEW" })).key).toBe(
      "failed",
    );
    expect(paymentRefusal(answered(409, {})).key).toBe("failed");
    expect(paymentRefusal(new AxiosError("timeout", "ECONNABORTED")).key).toBe(
      "failed",
    );
    expect(paymentRefusal(new Error("boom")).key).toBe("failed");
  });

  it("не полагается на interceptor: код читается на любом статусе (AC-13)", () => {
    expect(
      axios.isAxiosError(answered(409, { code: "ORDER_NOT_PAYABLE" })),
    ).toBe(true);
    expect(
      paymentRefusal(answered(409, { code: "ORDER_NOT_PAYABLE" })).key,
    ).toBe("notPayable");
  });
});
