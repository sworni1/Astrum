import { describe, expect, it } from "vitest";
import { PaymentStatus } from "@/common/types/order.types";
import { showsPaymentSentence } from "@/features/pages/Orders/OrderPage/lib/cancelDialogCopy";

describe("showsPaymentSentence", () => {
  it("names the payment only while it is still pending", () => {
    expect(showsPaymentSentence(PaymentStatus.PENDING)).toBe(true);
  });

  it("says nothing about money for a payment that already moved", () => {
    for (const status of [
      PaymentStatus.PAID,
      PaymentStatus.CANCELLED,
      PaymentStatus.FAILED,
      PaymentStatus.REFUNDED,
    ]) {
      expect(showsPaymentSentence(status)).toBe(false);
    }
  });
});
