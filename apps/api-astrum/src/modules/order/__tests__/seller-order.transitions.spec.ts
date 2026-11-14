jest.mock("../../../../lib/prisma", () => ({ prisma: {} }));

import type { OrderItemStatus } from "../../../../generated/prisma/enums";
import { ALLOWED_LINE_TRANSITIONS } from "../seller-order.service";

/**
 * The per line transition table of spec 0016, AC-5, transcribed from its
 * "Feature design" section: the seller cancels a line, and a legacy `SHIPPED`
 * line can still be closed as delivered. Confirming and shipping are gone.
 */
const SPEC_TABLE: Record<OrderItemStatus, readonly OrderItemStatus[]> = {
  PENDING: [],
  CONFIRMED: ["CANCELLED"],
  SHIPPED: ["CANCELLED", "DELIVERED"],
  OUT_OF_STOCK: [],
  CANCELLED: [],
  DELIVERED: [],
  RETURNED: [],
  BACKORDERED: [],
  REPLACED: [],
};

describe("ALLOWED_LINE_TRANSITIONS", () => {
  it("matches the per line table of spec 0016 for all nine statuses (AC-5)", () => {
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

  it("refuses the moves the platform took over (AC-5)", () => {
    expect(ALLOWED_LINE_TRANSITIONS.PENDING).not.toContain("CONFIRMED");
    expect(ALLOWED_LINE_TRANSITIONS.PENDING).not.toContain("OUT_OF_STOCK");
    expect(ALLOWED_LINE_TRANSITIONS.CONFIRMED).not.toContain("SHIPPED");
    expect(ALLOWED_LINE_TRANSITIONS.CONFIRMED).not.toContain("DELIVERED");
    // The payment ships a paid line, and the seller must still be able to report
    // it gone, because that is the move that returns the money.
    expect(ALLOWED_LINE_TRANSITIONS.SHIPPED).toContain("CANCELLED");
  });
});
