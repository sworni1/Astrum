import { describe, expect, it } from "vitest";
import {
  OrderItemStatus,
  type SellerOrderLine,
} from "@/common/types/order.types";
import { HANDOVER_READY_STATUSES, handoverableCount } from "@/features/pages/SellerOrders/lib/handover";

const line = (status: OrderItemStatus): SellerOrderLine => ({
  id: `line-${status}`,
  productId: "product-1",
  name: "Kettle",
  previewImage: "",
  quantity: 1,
  price: 10,
  currency: "RUB" as SellerOrderLine["currency"],
  status,
});

describe("handoverableCount", () => {
  it("считает только CONFIRMED и SHIPPED (AC-13)", () => {
    expect([...HANDOVER_READY_STATUSES].sort()).toEqual([
      OrderItemStatus.CONFIRMED,
      OrderItemStatus.SHIPPED,
    ]);

    expect(
      handoverableCount([
        line(OrderItemStatus.CONFIRMED),
        line(OrderItemStatus.SHIPPED),
        line(OrderItemStatus.PENDING),
        line(OrderItemStatus.DELIVERED),
        line(OrderItemStatus.CANCELLED),
      ]),
    ).toBe(2);
  });

  it("отвечает нулём, когда выдавать нечего (AC-13)", () => {
    expect(handoverableCount([])).toBe(0);
    expect(handoverableCount([line(OrderItemStatus.PENDING)])).toBe(0);
  });
});
