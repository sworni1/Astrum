import { Prisma } from "@astrum/db/client";
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
    expect(json.orderItems[0]).not.toHaveProperty("brandName");
    expect(json.orderItems[0]).not.toHaveProperty("subtotal");
    expect(json).not.toHaveProperty("paidAt");
  });

  it("печатает магазин, вид и сумму строки, когда их разрешило чтение деталей (AC-1)", () => {
    const json = toOrderJson({
      ...order,
      paidAt: new Date("2026-11-14T15:08:00.000Z"),
      orderItems: [
        {
          id: "line-1",
          price: new Prisma.Decimal("19.99"),
          quantity: 3,
          businessId: "private-business",
          brandName: "Parker",
          kind: "Ручки",
        },
      ],
    } as never);

    expect(json.paidAt).toEqual(new Date("2026-11-14T15:08:00.000Z"));
    expect(json.orderItems[0].brandName).toBe("Parker");
    expect(json.orderItems[0].kind).toBe("Ручки");
    expect(json.orderItems[0].subtotal).toBe(59.97);
    expect(json.orderItems[0]).not.toHaveProperty("businessId");
    expect(json).not.toHaveProperty("idempotencyKey");
  });

  it("печатает вид пустым, когда у товара нет подкатегории (AC-1, AC-3)", () => {
    const json = toOrderJson({
      ...order,
      paidAt: null,
      orderItems: [
        {
          id: "line-1",
          price: new Prisma.Decimal("19.99"),
          quantity: 1,
          businessId: "private-business",
          brandName: "",
          kind: null,
        },
      ],
    } as never);

    expect(json.paidAt).toBeNull();
    expect(json.orderItems[0].kind).toBeNull();
    expect(json.orderItems[0].subtotal).toBe(19.99);
  });

  it("отдаёт строки, счётчики и потраченное без служебных колонок (AC-1, AC-5, AC-6)", () => {
    const json = toOrderListJson({
      items: [
        {
          id: "order-1",
          status: "DELIVERED",
          createdAt: new Date("2026-11-14T10:00:00.000Z"),
          grandTotal: new Prisma.Decimal("309.00"),
          currency: "RUB",
          orderItems: [
            {
              id: "line-1",
              name: "Parker Urban T200",
              previewImage: "",
              quantity: 18,
              status: "DELIVERED",
              receiptDate: null,
            },
          ],
        },
      ],
      counts: { all: 3, delivered: 2, canceled: 1 },
      spent: [{ currency: "RUB", amount: new Prisma.Decimal("120.00") }],
    } as never);

    expect(json.items[0].grandTotal).toBe(309);
    expect(json.items[0].orderItems).toEqual([
      {
        id: "line-1",
        name: "Parker Urban T200",
        previewImage: "",
        quantity: 18,
        status: "DELIVERED",
        receiptDate: null,
      },
    ]);
    expect(json.counts).toEqual({ all: 3, delivered: 2, canceled: 1 });
    expect(json.spent).toEqual([{ currency: "RUB", amount: 120 }]);
    expect(json.items[0]).not.toHaveProperty("userId");
    expect(json.items[0]).not.toHaveProperty("totalPrice");
    expect(json.items[0]).not.toHaveProperty("idempotencyKey");
    expect(json.items[0]).not.toHaveProperty("orderItemsCount");
  });
});
