import { describe, expect, it } from "vitest";
import {
  CheckoutRefusal,
  checkoutRefusalOf,
  isCheckoutErrorCode,
  refusalReaction,
} from "@/hooks/order/checkoutErrors";

const axiosError = (code: string) => ({
  isAxiosError: true,
  response: { status: 409, data: { code, message: "server wording" } },
});

describe("checkout refusal codes", () => {
  it("знает три кода способа доставки и три кода точки (AC-6)", () => {
    expect(isCheckoutErrorCode("UNKNOWN_SHIPPING_METHOD")).toBe(true);
    expect(isCheckoutErrorCode("SHIPPING_METHOD_INACTIVE")).toBe(true);
    expect(isCheckoutErrorCode("SHIPPING_CURRENCY_MISMATCH")).toBe(true);
    expect(isCheckoutErrorCode("UNKNOWN_PICKUP_POINT")).toBe(true);
    expect(isCheckoutErrorCode("PICKUP_POINT_INACTIVE")).toBe(true);
    expect(isCheckoutErrorCode("PICKUP_POINT_NOT_ALLOWED")).toBe(true);
    expect(isCheckoutErrorCode("OUT_OF_STOCK")).toBe(false);
  });

  it("поднимает отказ только для этих шести кодов (AC-6)", () => {
    expect(
      checkoutRefusalOf(axiosError("SHIPPING_METHOD_INACTIVE"))?.code,
    ).toBe("SHIPPING_METHOD_INACTIVE");
    expect(checkoutRefusalOf(axiosError("PICKUP_POINT_INACTIVE"))?.code).toBe(
      "PICKUP_POINT_INACTIVE",
    );
    expect(checkoutRefusalOf(axiosError("OUT_OF_STOCK"))).toBeUndefined();
    expect(checkoutRefusalOf(new Error("network"))).toBeUndefined();
  });

  it("берёт код, а не текст сервера (AC-6)", () => {
    const refusal = checkoutRefusalOf(axiosError("SHIPPING_CURRENCY_MISMATCH"));

    expect(refusal?.message).toBe("SHIPPING_CURRENCY_MISMATCH");
    expect(refusal?.message).not.toBe("server wording");
  });
});

describe("refusalReaction", () => {
  it("сбрасывает выбор и перечитывает список для неизвестного метода (AC-6)", () => {
    expect(
      refusalReaction(new CheckoutRefusal("UNKNOWN_SHIPPING_METHOD")),
    ).toEqual({ key: "shippingUnknown", resetMethod: true, resetPoint: false });
  });

  it("делает то же для выключенного метода (AC-6)", () => {
    expect(
      refusalReaction(new CheckoutRefusal("SHIPPING_METHOD_INACTIVE")),
    ).toEqual({ key: "shippingInactive", resetMethod: true, resetPoint: false });
  });

  it("оставляет поля как есть при несовпадении валюты (AC-6)", () => {
    expect(
      refusalReaction(new CheckoutRefusal("SHIPPING_CURRENCY_MISMATCH")),
    ).toEqual({
      key: "shippingCurrencyMismatch",
      resetMethod: false,
      resetPoint: false,
    });
  });

  it("сбрасывает точку и перечитывает список для выключенной точки (AC-6)", () => {
    expect(
      refusalReaction(new CheckoutRefusal("PICKUP_POINT_INACTIVE")),
    ).toEqual({ key: "pickupInactive", resetMethod: false, resetPoint: true });
  });

  it("делает то же для неизвестной точки (AC-6)", () => {
    expect(
      refusalReaction(new CheckoutRefusal("UNKNOWN_PICKUP_POINT")),
    ).toEqual({
      key: "unknownPickupPoint",
      resetMethod: false,
      resetPoint: true,
    });
  });

  it("перечитывает способы, когда способ перестал быть точкой (AC-6)", () => {
    expect(
      refusalReaction(new CheckoutRefusal("PICKUP_POINT_NOT_ALLOWED")),
    ).toEqual({
      key: "pickupNotAllowed",
      resetMethod: true,
      resetPoint: false,
    });
  });

  it("молчит на любую другую ошибку (AC-6)", () => {
    expect(refusalReaction(new Error("db is down"))).toBeUndefined();
  });
});
