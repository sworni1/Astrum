import { describe, expect, it } from "vitest";
import {
  type Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/common/types/order.types";
import {
  canPay,
  lineRefundOwed,
  PAYMENT_KEYS,
  PAYMENT_STATUS_KEYS,
  paymentStatusKey,
  paymentUnconfirmed,
  paymentWindowPassed,
  refundOwed,
} from "@/features/pages/Orders/OrderPage/lib/payment";

const NOW = new Date("2026-11-12T12:00:00.000Z");

const order = (overrides: Partial<Order> = {}): Order =>
  ({
    id: "order-1",
    paymentMethod: PaymentMethod.ONLINE_CARD,
    paymentStatus: PaymentStatus.PENDING,
    paymentExpiresAt: "2026-11-12T12:20:00.000Z",
    status: OrderStatus.PENDING,
    ...overrides,
  }) as Order;

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

describe("canPay", () => {
  it("offers the control for a live online card order (AC-13)", () => {
    expect(canPay(order(), NOW)).toBe(true);
  });

  it("offers it again on a failed payment inside the window (AC-13)", () => {
    expect(canPay(order({ paymentStatus: PaymentStatus.FAILED }), NOW)).toBe(
      true,
    );
  });

  it("refuses it for another method, a cancelled order, a paid one or a spent window (AC-13)", () => {
    expect(canPay(order({ paymentMethod: PaymentMethod.CASH }), NOW)).toBe(
      false,
    );
    expect(canPay(order({ status: OrderStatus.CANCELED }), NOW)).toBe(false);
    expect(canPay(order({ paymentStatus: PaymentStatus.PAID }), NOW)).toBe(
      false,
    );
    expect(
      canPay(order({ paymentExpiresAt: "2026-11-12T11:59:00.000Z" }), NOW),
    ).toBe(false);
    expect(canPay(order({ paymentExpiresAt: null }), NOW)).toBe(false);
  });
});

describe("paymentUnconfirmed", () => {
  it("holds for a pending and for a failed payment", () => {
    expect(paymentUnconfirmed(order())).toBe(true);
    expect(
      paymentUnconfirmed(order({ paymentStatus: PaymentStatus.FAILED })),
    ).toBe(true);
  });

  it("does not hold for a paid order, so the return copy stays off it (AC-14)", () => {
    expect(
      paymentUnconfirmed(order({ paymentStatus: PaymentStatus.PAID })),
    ).toBe(false);
    expect(
      paymentUnconfirmed(order({ paymentStatus: PaymentStatus.CANCELLED })),
    ).toBe(false);
    expect(
      paymentUnconfirmed(order({ paymentStatus: PaymentStatus.REFUNDED })),
    ).toBe(false);
  });
});

describe("paymentWindowPassed", () => {
  it("says the window is spent only for an uncancelled online order (AC-13)", () => {
    expect(
      paymentWindowPassed(
        order({ paymentExpiresAt: "2026-11-12T11:00:00.000Z" }),
        NOW,
      ),
    ).toBe(true);
    expect(paymentWindowPassed(order(), NOW)).toBe(false);
    expect(
      paymentWindowPassed(
        order({
          status: OrderStatus.CANCELED,
          paymentExpiresAt: "2026-11-12T11:00:00.000Z",
        }),
        NOW,
      ),
    ).toBe(false);
  });
});

describe("refundOwed", () => {
  it("flags a cancelled order that was paid (AC-12)", () => {
    expect(
      refundOwed(
        order({
          status: OrderStatus.CANCELED,
          paymentStatus: PaymentStatus.PAID,
        }),
      ),
    ).toBe(true);
    expect(refundOwed(order())).toBe(false);
  });
});

describe("lineRefundOwed", () => {
  const withLines = (statuses: string[]): Order =>
    order({
      status: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      orderItems: statuses.map((status, index) => ({
        id: `line-${index}`,
        status,
      })) as Order["orderItems"],
    });

  it("flags a paid order that holds a cancelled line (AC-9)", () => {
    expect(lineRefundOwed(withLines(["CONFIRMED", "CANCELLED"]))).toBe(true);
  });

  it("stays quiet for an unpaid order and for a paid one with live lines (AC-9)", () => {
    expect(
      lineRefundOwed(
        order({
          paymentStatus: PaymentStatus.PENDING,
          orderItems: [
            { id: "line-1", status: "CANCELLED" },
          ] as Order["orderItems"],
        }),
      ),
    ).toBe(false);
    expect(lineRefundOwed(withLines(["CONFIRMED", "DELIVERED"]))).toBe(false);
  });
});
