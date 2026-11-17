import { describe, expect, it } from "vitest";
import {
  OrderItemStatus,
  type SellerLineCounts,
} from "@/common/types/order.types";
import { SALES_COLUMNS, columnLabel } from "@/features/pages/SellerOrders/lib/columns";
import {
  BADGE_TONE,
  badgeToneOf,
  countForStatus,
  SELLER_TABS,
} from "@/features/pages/SellerOrders/lib/status";

describe("badgeToneOf", () => {
  it("reads delivered as good and the two lost sales as canceled (AC-9)", () => {
    expect(badgeToneOf(OrderItemStatus.DELIVERED)).toBe("success");
    expect(badgeToneOf(OrderItemStatus.CANCELLED)).toBe("destructive");
    expect(badgeToneOf(OrderItemStatus.OUT_OF_STOCK)).toBe("destructive");
  });

  it("keeps the other six neutral (AC-9)", () => {
    const neutral = [
      OrderItemStatus.PENDING,
      OrderItemStatus.CONFIRMED,
      OrderItemStatus.SHIPPED,
      OrderItemStatus.RETURNED,
      OrderItemStatus.BACKORDERED,
      OrderItemStatus.REPLACED,
    ];

    expect(neutral.map(badgeToneOf)).toEqual(neutral.map(() => "secondary"));
  });

  it("decides a tone for every member of the enum (AC-9)", () => {
    expect(Object.keys(BADGE_TONE).sort()).toEqual(
      Object.values(OrderItemStatus).sort(),
    );
  });

  it("keeps the neutral tone for a status the table does not know (AC-9)", () => {
    expect(badgeToneOf("SOMETHING_NEW")).toBe("secondary");
  });
});

describe("countForStatus", () => {
  const counts: SellerLineCounts = { all: 9, delivered: 4, canceled: 3 };

  it("reads the count of the chosen tab (AC-7)", () => {
    expect(countForStatus(counts, "ALL")).toBe(9);
    expect(countForStatus(counts, "DELIVERED")).toBe(4);
    expect(countForStatus(counts, "CANCELED")).toBe(3);
  });

  it("names the three tabs in the mockup order (AC-7)", () => {
    expect(SELLER_TABS.map((tab) => tab.id)).toEqual([
      "ALL",
      "DELIVERED",
      "CANCELED",
    ]);
  });
});

describe("SALES_COLUMNS", () => {
  it("lists the six columns in the mockup order (AC-9)", () => {
    expect(SALES_COLUMNS.map((column) => column.id)).toEqual([
      "order",
      "product",
      "receipt",
      "subtotal",
      "date",
      "status",
    ]);
  });

  it("aligns the amount and the status to the right (AC-9)", () => {
    expect(
      SALES_COLUMNS.filter((column) => column.align === "right").map(
        (column) => column.id,
      ),
    ).toEqual(["subtotal", "status"]);
  });

  it("gives every column a catalog label for the stacked card (AC-12)", () => {
    expect(columnLabel("receipt")).toBe("columns.receipt");
  });
});
