import { describe, expect, it } from "vitest";
import { PaymentMethod, PaymentStatus } from "@/common/types/order.types";
import { PAYMENT_KEYS, PAYMENT_STATUS_KEYS, paymentStatusKey } from "./payment";

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

describe("paymentStatusKey", () => {
  it("names one catalog key for every payment status", () => {
    expect(Object.values(PaymentStatus)).toHaveLength(5);

    for (const status of Object.values(PaymentStatus)) {
      expect(paymentStatusKey(status)).toBeTypeOf("string");
    }

    expect(new Set(Object.values(PAYMENT_STATUS_KEYS)).size).toBe(5);
  });

  it("gives a cancelled payment a label of its own beside Paid", () => {
    expect(paymentStatusKey(PaymentStatus.PAID)).toBe("paid");
    expect(paymentStatusKey(PaymentStatus.PENDING)).toBe("pending");
    expect(paymentStatusKey(PaymentStatus.CANCELLED)).toBe("cancelled");
    expect(paymentStatusKey(PaymentStatus.FAILED)).toBe("failed");
    expect(paymentStatusKey(PaymentStatus.REFUNDED)).toBe("refunded");
  });

  it("prints a status outside the enum as it is", () => {
    expect(paymentStatusKey("SOMETHING_NEW")).toBeUndefined();
  });
});
