import { describe, expect, it } from "vitest";
import {
  CheckoutRefusal,
  checkoutRefusalOf,
  isCheckoutErrorCode,
  refusalReaction,
} from "./checkoutErrors";

const axiosError = (code: string) => ({
  isAxiosError: true,
  response: { status: 409, data: { code, message: "server wording" } },
});

describe("checkout refusal codes", () => {
  it("знает ровно три кода способа доставки (AC-11)", () => {
    expect(isCheckoutErrorCode("UNKNOWN_SHIPPING_METHOD")).toBe(true);
    expect(isCheckoutErrorCode("SHIPPING_METHOD_INACTIVE")).toBe(true);
    expect(isCheckoutErrorCode("SHIPPING_CURRENCY_MISMATCH")).toBe(true);
    expect(isCheckoutErrorCode("OUT_OF_STOCK")).toBe(false);
  });

  it("поднимает отказ только для этих трёх кодов (AC-11)", () => {
    expect(
      checkoutRefusalOf(axiosError("SHIPPING_METHOD_INACTIVE"))?.code,
    ).toBe("SHIPPING_METHOD_INACTIVE");
    expect(checkoutRefusalOf(axiosError("OUT_OF_STOCK"))).toBeUndefined();
    expect(checkoutRefusalOf(new Error("network"))).toBeUndefined();
  });

  it("берёт код, а не текст сервера (AC-11)", () => {
    const refusal = checkoutRefusalOf(axiosError("SHIPPING_CURRENCY_MISMATCH"));

    expect(refusal?.message).toBe("SHIPPING_CURRENCY_MISMATCH");
    expect(refusal?.message).not.toBe("server wording");
  });
});

describe("refusalReaction", () => {
  it("сбрасывает выбор и перечитывает список для неизвестного метода (AC-11)", () => {
    expect(
      refusalReaction(new CheckoutRefusal("UNKNOWN_SHIPPING_METHOD")),
    ).toEqual({ key: "shippingUnknown", resetMethod: true });
  });

  it("делает то же для выключенного метода (AC-11)", () => {
    expect(
      refusalReaction(new CheckoutRefusal("SHIPPING_METHOD_INACTIVE")),
    ).toEqual({ key: "shippingInactive", resetMethod: true });
  });

  it("оставляет поля как есть при несовпадении валюты (AC-11)", () => {
    expect(
      refusalReaction(new CheckoutRefusal("SHIPPING_CURRENCY_MISMATCH")),
    ).toEqual({ key: "shippingCurrencyMismatch", resetMethod: false });
  });

  it("молчит на любую другую ошибку (AC-11)", () => {
    expect(refusalReaction(new Error("db is down"))).toBeUndefined();
  });
});
