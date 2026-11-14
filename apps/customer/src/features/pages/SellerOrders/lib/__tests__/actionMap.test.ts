import { describe, expect, it } from "vitest";
import { OrderItemStatus } from "@/common/types/order.types";
import {
  isConfirmingAction,
  SELLER_ACTION_TARGET,
  SELLER_CONFIRMING_ACTIONS,
  SELLER_LINE_ACTIONS,
  sellerLineActions,
} from "@/features/pages/SellerOrders/lib/actionMap";

/**
 * The per line table of spec 0016, AC-5, transcribed from its design section:
 * the platform confirms and ships, the seller reports a line gone, and that is
 * all. A shipped line still offers it, because that is the refund move.
 */
const SPEC_TABLE: Record<string, string[]> = {
  PENDING: [],
  CONFIRMED: ["CANCELLED"],
  SHIPPED: ["CANCELLED"],
  OUT_OF_STOCK: [],
  CANCELLED: [],
  DELIVERED: [],
  RETURNED: [],
  BACKORDERED: [],
  REPLACED: [],
};

describe("seller line action map", () => {
  it("mirrors the per line table of spec 0016 for all nine statuses (AC-5, AC-8)", () => {
    expect(Object.keys(SELLER_LINE_ACTIONS)).toEqual([
      OrderItemStatus.CONFIRMED,
      OrderItemStatus.SHIPPED,
    ]);

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

  it("asks before the one move it offers (AC-8)", () => {
    expect([...SELLER_CONFIRMING_ACTIONS]).toEqual(["gone"]);
    expect(isConfirmingAction("gone")).toBe(true);
  });

  it("offers no move for a line the platform owns (AC-5, AC-8)", () => {
    expect(sellerLineActions(OrderItemStatus.PENDING)).toEqual([]);
    expect(sellerLineActions(OrderItemStatus.DELIVERED)).toEqual([]);
    expect(sellerLineActions("SOMETHING_NEW")).toEqual([]);
  });

  it("still offers the item is gone on a line the payment shipped (AC-5, AC-8)", () => {
    expect(sellerLineActions(OrderItemStatus.SHIPPED)).toEqual(["gone"]);
  });

  it("offers exactly the item is gone on a confirmed line (AC-5, AC-8)", () => {
    expect(sellerLineActions(OrderItemStatus.CONFIRMED)).toEqual(["gone"]);
    expect(SELLER_ACTION_TARGET.gone).toBe(OrderItemStatus.CANCELLED);
  });
});
