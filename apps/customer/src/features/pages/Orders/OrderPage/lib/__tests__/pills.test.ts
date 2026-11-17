import { describe, expect, it } from "vitest";
import {
  OrderItemStatus,
  PaymentStatus,
} from "@/common/types/order.types";
import {
  lineTone,
  PAYMENT_TONES,
  paymentTone,
} from "@/features/pages/Orders/OrderPage/lib/pills";

describe("lineTone", () => {
  it("prints a pill for the three states the mockup marks (AC-3, AC-8)", () => {
    expect(lineTone(OrderItemStatus.CANCELLED)).toBe("destructive");
    expect(lineTone(OrderItemStatus.RETURNED)).toBe("destructive");
    expect(lineTone(OrderItemStatus.OUT_OF_STOCK)).toBe("neutral");
  });

  it("prints no pill for every other line state", () => {
    for (const status of [
      OrderItemStatus.PENDING,
      OrderItemStatus.CONFIRMED,
      OrderItemStatus.SHIPPED,
      OrderItemStatus.DELIVERED,
      OrderItemStatus.BACKORDERED,
      OrderItemStatus.REPLACED,
    ]) {
      expect(lineTone(status)).toBeNull();
    }
  });
});

describe("paymentTone", () => {
  it("lands every payment status on one of the three token sets (AC-8)", () => {
    expect(paymentTone(PaymentStatus.PAID)).toBe("success");
    expect(paymentTone(PaymentStatus.PENDING)).toBe("neutral");
    expect(paymentTone(PaymentStatus.FAILED)).toBe("destructive");
    expect(paymentTone(PaymentStatus.CANCELLED)).toBe("destructive");
    expect(paymentTone(PaymentStatus.REFUNDED)).toBe("destructive");
  });

  it("covers every status the enum carries", () => {
    for (const status of Object.values(PaymentStatus)) {
      expect(PAYMENT_TONES[status]).toBeTypeOf("string");
    }
  });
});
