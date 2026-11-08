import { describe, expect, it } from "vitest";
import {
  OrderItemStatus,
  type SellerOrderLine,
} from "../../../common/types/order.types";
import { countLinesByStatus, lineSubtotal } from "./format";

const line = (overrides: Partial<SellerOrderLine> = {}): SellerOrderLine => ({
  id: "line-1",
  productId: "product-1",
  name: "Kettle",
  previewImage: "",
  quantity: 1,
  price: 19.99,
  currency: "RUB" as SellerOrderLine["currency"],
  status: OrderItemStatus.PENDING,
  ...overrides,
});

describe("lineSubtotal", () => {
  it("rounds the float multiply back to cents for display (AC-4)", () => {
    expect(7 * 19.99).toBe(139.92999999999998);
    expect(lineSubtotal(line({ quantity: 7 }))).toBe(139.93);

    expect(6 * 4.35).toBe(26.099999999999998);
    expect(lineSubtotal(line({ quantity: 6, price: 4.35 }))).toBe(26.1);
  });

  it("keeps a whole rouble total exact (AC-4)", () => {
    expect(lineSubtotal(line({ quantity: 2, price: 2772 }))).toBe(5544);
  });
});

describe("countLinesByStatus", () => {
  it("counts one group in the order of the enum (AC-4)", () => {
    expect(
      countLinesByStatus([
        line({ id: "a", status: OrderItemStatus.PENDING }),
        line({ id: "b", status: OrderItemStatus.CANCELLED }),
        line({ id: "c", status: OrderItemStatus.PENDING }),
      ]),
    ).toEqual([
      { status: OrderItemStatus.PENDING, count: 2 },
      { status: OrderItemStatus.CANCELLED, count: 1 },
    ]);
  });

  it("keeps a status outside the enum at the end (AC-6)", () => {
    expect(
      countLinesByStatus([
        line({ id: "a", status: "SOMETHING_NEW" as OrderItemStatus }),
      ]),
    ).toEqual([{ status: "SOMETHING_NEW", count: 1 }]);
  });
});
