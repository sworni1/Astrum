jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(),
    business: { findUnique: jest.fn() },
    order: { findMany: jest.fn() },
  },
}));

import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { SellerOrderService } from "../seller-order.service";

const prismaMock = prisma as unknown as {
  $queryRaw: jest.Mock;
  business: { findUnique: jest.Mock };
  order: { findMany: jest.Mock };
};

const sellerLine = (status: string = "PENDING") => ({
  id: "line-1",
  orderId: "order-1",
  productId: "product-1",
  name: "Drill",
  previewImage: "https://cdn.test/drill.png",
  quantity: 2,
  price: new Prisma.Decimal("19.99"),
  currency: "RUB",
  status,
});

describe("SellerOrderService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns only owned order lines and caps pagination (AC-5)", async () => {
    prismaMock.business.findUnique.mockResolvedValue({ id: "business-1" });
    prismaMock.$queryRaw.mockResolvedValue([{ total: 3 }]);
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: "order-1",
        createdAt: new Date("2026-11-07T10:00:00.000Z"),
        isPickup: undefined,
        shippingMethod: { isPickup: true },
        pickupPointId: "pp-1",
        pickupPointName: "Central Pickup",
        pickupPointAddress: "Tverskaya 12",
        handedOverAt: null,
        OrderItem: [sellerLine()],
      },
    ]);

    const result = await new SellerOrderService().getSellerOrders(
      "seller-1",
      "2",
      "80",
    );

    expect(result).toMatchObject({
      page: 2,
      limit: 50,
      total: 3,
      totalPages: 1,
    });
    expect(result.orders[0]).toMatchObject({
      id: "order-1",
      createdAt: new Date("2026-11-07T10:00:00.000Z"),
      isPickup: true,
      pickupPointId: "pp-1",
      pickupPointName: "Central Pickup",
      pickupPointAddress: "Tverskaya 12",
      handedOverAt: null,
      orderItems: [
        {
          id: "line-1",
          productId: "product-1",
          name: "Drill",
          quantity: 2,
          currency: "RUB",
          status: "PENDING",
        },
      ],
    });
    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OrderItem: {
            some: { business: { is: { ownerUserId: "seller-1" } } },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        select: expect.objectContaining({
          OrderItem: expect.objectContaining({
            where: { business: { is: { ownerUserId: "seller-1" } } },
            orderBy: { id: "asc" },
          }),
        }),
        skip: 50,
        take: 50,
      }),
    );
  });

  it.each(["0", "-1", "1.5", "nope", "9007199254740992"])(
    "rejects invalid page values such as %s (AC-5)",
    async (page) => {
      await expect(
        new SellerOrderService().getSellerOrders("seller-1", page, "20"),
      ).rejects.toMatchObject({ status: 422, code: "VALIDATION" });
    },
  );

  it("rejects users without an assigned business (AC-5)", async () => {
    prismaMock.business.findUnique.mockResolvedValue(null);
    await expect(
      new SellerOrderService().getSellerOrders("seller-1"),
    ).rejects.toMatchObject({ status: 403, code: "SELLER_NOT_ASSIGNED" });
  });

  it("exposes no write on the seller service any more (AC-10)", () => {
    const service = new SellerOrderService() as unknown as Record<string, unknown>;

    expect(service).not.toHaveProperty("handOverOrder");
    expect(service).not.toHaveProperty("updateSellerOrderItemStatus");
  });
});
