import { describe, expect, it } from "vitest";
import { PaymentMethod } from "@/common/types/order.types";
import { PAYMENT_KEYS } from "./payment";

describe("PAYMENT_KEYS", () => {
  it("names one catalog key for every payment method", () => {
    expect(Object.values(PaymentMethod)).toHaveLength(5);

    for (const method of Object.values(PaymentMethod)) {
      expect(PAYMENT_KEYS[method]).toBeTypeOf("string");
    }
  });

  it("gives each method its own label", () => {
    expect(PAYMENT_KEYS[PaymentMethod.ONLINE_CARD]).toBe("onlineCard");
    expect(PAYMENT_KEYS[PaymentMethod.PAYPAL]).toBe("paypal");
    expect(PAYMENT_KEYS[PaymentMethod.STRIPE]).toBe("stripe");
    expect(PAYMENT_KEYS[PaymentMethod.CARD_ON_DELIVERY]).toBe("cardOnDelivery");
    expect(PAYMENT_KEYS[PaymentMethod.CASH]).toBe("cash");

    expect(new Set(Object.values(PAYMENT_KEYS)).size).toBe(5);
  });
});
