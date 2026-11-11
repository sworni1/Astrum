import { describe, expect, it } from "vitest";
import { OrderStatus } from "@/common/types/order.types";
import {
  DELIVERY_STEPS,
  deliverySteps,
  STATUS_KEYS,
  statusColor,
} from "./status";

describe("STATUS_KEYS", () => {
  it("names one catalog key for every order status", () => {
    expect(Object.values(OrderStatus)).toHaveLength(5);

    for (const status of Object.values(OrderStatus)) {
      expect(STATUS_KEYS[status]).toBeTypeOf("string");
    }
  });
});

describe("statusColor", () => {
  it("paints the badge by the status the order reached", () => {
    expect(statusColor(OrderStatus.PENDING)).toBe("bg-yellow-500");
    expect(statusColor(OrderStatus.CONFIRMED)).toBe("bg-yellow-500");
    expect(statusColor(OrderStatus.SHIPPED)).toBe("bg-blue-500");
    expect(statusColor(OrderStatus.DELIVERED)).toBe("bg-green-500");
    expect(statusColor(OrderStatus.CANCELED)).toBe("bg-red-500");
  });

  it("falls back to grey for a status the storefront does not know", () => {
    expect(statusColor("SOMETHING_NEW" as OrderStatus)).toBe("bg-gray-500");
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
