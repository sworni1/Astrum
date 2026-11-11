import { describe, expect, it } from "vitest";
import {
  OrderItemStatus,
  type SellerOrderLine,
  type SellerOrdersPage,
} from "@/common/types/order.types";
import { pageWithLine } from "./pageData";

const line = (overrides: Partial<SellerOrderLine> = {}): SellerOrderLine => ({
  id: "line-1",
  productId: "product-1",
  name: "Kettle",
  previewImage: "",
  quantity: 2,
  price: 9.99,
  currency: "RUB" as SellerOrderLine["currency"],
  status: OrderItemStatus.PENDING,
  ...overrides,
});

const page = (): SellerOrdersPage => ({
  orders: [
    {
      id: "order-1",
      createdAt: "2026-11-08T10:00:00.000Z",
      orderItems: [
        line(),
        line({
          id: "line-2",
          name: "Whistle",
          status: OrderItemStatus.CONFIRMED,
        }),
      ],
    },
    {
      id: "order-2",
      createdAt: "2026-11-07T10:00:00.000Z",
      orderItems: [line({ id: "line-3", name: "Mug" })],
    },
  ],
  page: 1,
  limit: 20,
  total: 21,
  totalPages: 2,
});

describe("pageWithLine", () => {
  it("writes the answered line where it stands and leaves its neighbours alone (AC-9)", () => {
    const before = page();
    const answered = line({ status: OrderItemStatus.CANCELLED });

    const after = pageWithLine(before, answered);

    expect(after.orders[0].orderItems[0]).toMatchObject({
      id: "line-1",
      status: OrderItemStatus.CANCELLED,
    });
    expect(after.orders[0].orderItems[1]).toEqual(
      before.orders[0].orderItems[1],
    );
    expect(after.orders[1]).toEqual(before.orders[1]);
    expect(after.orders.map((order) => order.id)).toEqual([
      "order-1",
      "order-2",
    ]);
  });

  it("keeps the page numbers the server sent (AC-5, AC-9)", () => {
    const before = page();

    const after = pageWithLine(
      before,
      line({ status: OrderItemStatus.CONFIRMED }),
    );

    expect(after).toMatchObject({
      page: 1,
      limit: 20,
      total: 21,
      totalPages: 2,
    });
  });

  it("returns a new page and does not touch the one on screen (AC-9)", () => {
    const before = page();
    const snapshot = structuredClone(before);

    const after = pageWithLine(
      before,
      line({ status: OrderItemStatus.DELIVERED }),
    );

    expect(after).not.toBe(before);
    expect(before).toEqual(snapshot);
  });

  it("changes nothing when the answered line is not on this page (AC-9)", () => {
    const before = page();

    const after = pageWithLine(
      before,
      line({ id: "line-from-another-page", status: OrderItemStatus.CONFIRMED }),
    );

    expect(after).toEqual(before);
  });
});
