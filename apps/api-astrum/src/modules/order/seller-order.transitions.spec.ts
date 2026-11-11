jest.mock("../../../lib/prisma", () => ({ prisma: {} }));

import type { OrderItemStatus } from "../../../generated/prisma/enums";
import { ALLOWED_LINE_TRANSITIONS } from "./seller-order.service";

/**
 * The transition table of spec 0002, transcribed from its "Feature design"
 * section. The storefront keeps a mirror of it in
 * `apps/customer/src/features/pages/SellerOrders/lib/actionMap.ts`; this test fails
 * the gateway side the moment the two drift.
 */
const SPEC_TABLE: Record<OrderItemStatus, readonly OrderItemStatus[]> = {
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

describe("ALLOWED_LINE_TRANSITIONS", () => {
  it("matches the transition table of spec 0002 for all nine statuses (AC-15)", () => {
    expect(Object.keys(ALLOWED_LINE_TRANSITIONS).sort()).toEqual(
      Object.keys(SPEC_TABLE).sort(),
    );

    for (const status of Object.keys(SPEC_TABLE) as OrderItemStatus[]) {
      expect({
        status,
        targets: [...ALLOWED_LINE_TRANSITIONS[status]].sort(),
      }).toEqual({ status, targets: [...SPEC_TABLE[status]].sort() });
    }
  });
});
