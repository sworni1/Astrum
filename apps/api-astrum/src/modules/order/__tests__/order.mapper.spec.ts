import { Prisma } from "../../../../generated/prisma/client";
import { toOrderJson, toOrderListJson } from "../order.mapper";

const order = {
  id: "order-1",
  userId: "user-1",
  idempotencyKey: "key-abcdef",
  idempotencyHash: "a".repeat(64),
  totalPrice: new Prisma.Decimal("70.95"),
  currency: "RUB",
  shippingMethodName: "Standard",
  deliveryPrice: new Prisma.Decimal("5.99"),
  grandTotal: new Prisma.Decimal("76.94"),
  orderItems: [
    {
      id: "line-1",
      price: new Prisma.Decimal("19.99"),
      businessId: "private-business",
    },
  ],
};

describe("order mapper", () => {
  it("keeps seller ownership snapshots private in customer responses (AC-4, AC-12)", () => {
    const json = toOrderJson(order as never);

    expect(json).not.toHaveProperty("idempotencyKey");
    expect(json).not.toHaveProperty("idempotencyHash");
    expect(json.totalPrice).toBe(70.95);
    expect(json.deliveryPrice).toBe(5.99);
    expect(json.grandTotal).toBe(76.94);
    expect(json.shippingMethodName).toBe("Standard");
    expect(json).not.toHaveProperty("shippingMethod");
    expect(json.orderItems[0].price).toBe(19.99);
    expect(json.orderItems[0]).not.toHaveProperty("businessId");
  });

  it("keeps idempotency fields private in customer order lists (AC-12)", () => {
    const [json] = toOrderListJson([
      {
        id: "order-1",
        idempotencyKey: "key-abcdef",
        idempotencyHash: "a".repeat(64),
        totalPrice: new Prisma.Decimal("10.00"),
        deliveryPrice: new Prisma.Decimal("299.00"),
        grandTotal: new Prisma.Decimal("309.00"),
        orderItemsCount: 2,
        previewImage: "https://cdn.test/preview.png",
      } as never,
    ]);

    expect(json).not.toHaveProperty("idempotencyKey");
    expect(json).not.toHaveProperty("idempotencyHash");
    expect(json.totalPrice).toBe(10);
    expect(json.deliveryPrice).toBe(299);
    expect(json.grandTotal).toBe(309);
    expect(json.orderItemsCount).toBe(2);
    expect(json.previewImage).toBe("https://cdn.test/preview.png");
    expect(json).not.toHaveProperty("orderItems");
  });
});
