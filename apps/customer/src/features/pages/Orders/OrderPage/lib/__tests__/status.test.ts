import { describe, expect, it } from "vitest";
import { OrderStatus } from "@/common/types/order.types";
import {
  canCancel,
  DELIVERY_STEPS,
  deliverySteps,
  STATUS_KEYS,
  STATUS_TONES,
} from "@/features/pages/Orders/OrderPage/lib/status";

describe("canCancel", () => {
  it("offers the action at the two statuses the gateway accepts", () => {
    expect(canCancel(OrderStatus.PENDING)).toBe(true);
    expect(canCancel(OrderStatus.CONFIRMED)).toBe(true);
  });

  it("offers nothing once the parcel moved or the order is closed", () => {
    expect(canCancel(OrderStatus.SHIPPED)).toBe(false);
    expect(canCancel(OrderStatus.DELIVERED)).toBe(false);
    expect(canCancel(OrderStatus.CANCELED)).toBe(false);
  });
});

describe("STATUS_KEYS", () => {
  it("names one catalog key for every order status", () => {
    expect(Object.values(OrderStatus)).toHaveLength(5);

    for (const status of Object.values(OrderStatus)) {
      expect(STATUS_KEYS[status]).toBeTypeOf("string");
    }
  });
});

describe("STATUS_TONES", () => {
  it("lands every order status on one of the three token sets (AC-8)", () => {
    expect(STATUS_TONES[OrderStatus.DELIVERED]).toBe("success");
    expect(STATUS_TONES[OrderStatus.CANCELED]).toBe("destructive");

    for (const status of Object.values(OrderStatus)) {
      expect(["success", "destructive", "neutral"]).toContain(
        STATUS_TONES[status],
      );
    }
  });
});

describe("deliverySteps", () => {
  it("keeps the four steps in the order the parcel walks them", () => {
    expect(DELIVERY_STEPS.map((step) => step.status)).toEqual([
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ]);
  });

  it("marks every step up to the current one as reached", () => {
    expect(
      deliverySteps(OrderStatus.PENDING).map((step) => step.active),
    ).toEqual([true, false, false, false]);
    expect(
      deliverySteps(OrderStatus.CONFIRMED).map((step) => step.active),
    ).toEqual([true, true, false, false]);
    expect(
      deliverySteps(OrderStatus.SHIPPED).map((step) => step.active),
    ).toEqual([true, true, true, false]);
    expect(
      deliverySteps(OrderStatus.DELIVERED).map((step) => step.active),
    ).toEqual([true, true, true, true]);
  });

  it("marks no step reached for a cancelled order", () => {
    expect(
      deliverySteps(OrderStatus.CANCELED).map((step) => step.active),
    ).toEqual([false, false, false, false]);
  });

  it("marks no step reached for a status outside the enum", () => {
    expect(
      deliverySteps("SOMETHING_NEW" as OrderStatus).map((step) => step.active),
    ).toEqual([false, false, false, false]);
  });
});
