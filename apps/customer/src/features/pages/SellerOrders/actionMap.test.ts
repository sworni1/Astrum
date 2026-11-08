import { describe, expect, it } from "vitest";
import { OrderItemStatus } from "../../../common/types/order.types";
import {
  isConfirmingAction,
  SELLER_ACTION_TARGET,
  SELLER_CONFIRMING_ACTIONS,
  SELLER_LINE_ACTIONS,
  sellerLineActions,
} from "./actionMap";

/** The transition table of spec 0002, transcribed from its design section. */
const SPEC_TABLE: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "OUT_OF_STOCK", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  OUT_OF_STOCK: [],
  CANCELLED: [],
  DELIVERED: [],
  RETURNED: [],
  BACKORDERED: [],
  REPLACED: [],
};

describe("seller line action map", () => {
  it("mirrors the transition table of spec 0002 for all nine statuses (AC-6, AC-15)", () => {
    expect(Object.keys(SELLER_LINE_ACTIONS).sort()).toEqual(
      Object.keys(SPEC_TABLE).sort(),
    );

    for (const status of Object.values(OrderItemStatus)) {
      const targets = sellerLineActions(status)
        .map((action) => SELLER_ACTION_TARGET[action])
        .sort();

      expect({ status, targets }).toEqual({
        status,
        targets: [...SPEC_TABLE[status]].sort(),
      });
    }
  });

  it("asks before cancelling and before marking a line out of stock (AC-7)", () => {
    expect([...SELLER_CONFIRMING_ACTIONS].sort()).toEqual([
      "cancel",
      "outOfStock",
    ]);
    expect(isConfirmingAction("cancel")).toBe(true);
    expect(isConfirmingAction("confirm")).toBe(false);
  });

  it("offers no action for a finished line and for an unknown status (AC-6)", () => {
    expect(sellerLineActions("DELIVERED")).toEqual([]);
    expect(sellerLineActions("RETURNED")).toEqual([]);
    expect(sellerLineActions("SOMETHING_NEW")).toEqual([]);
  });

  it("keeps each status with at most one action that leaves a line open (AC-6)", () => {
    expect(sellerLineActions(OrderItemStatus.PENDING)).toEqual([
      "confirm",
      "outOfStock",
      "cancel",
    ]);
    expect(sellerLineActions(OrderItemStatus.CONFIRMED)).toEqual([
      "ship",
      "cancel",
    ]);
    expect(sellerLineActions(OrderItemStatus.SHIPPED)).toEqual(["deliver"]);
  });
});
