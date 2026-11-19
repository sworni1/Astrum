jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    business: { findUnique: jest.fn() },
    orderItem: { count: jest.fn(), findMany: jest.fn() },
  },
}));

import { Prisma } from "@astrum/db/client";
import { prisma } from "../../../../lib/prisma";
import { SellerOrderService } from "../seller-order.service";

const prismaMock = prisma as unknown as {
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  business: { findUnique: jest.Mock };
  orderItem: { count: jest.Mock; findMany: jest.Mock };
};

const lineRow = (over: Record<string, unknown> = {}) => ({
  id: "line-1",
  orderId: "order-12345678",
  productId: "product-1",
  name: "Drill",
  previewImage: "https://cdn.test/drill.png",
  quantity: 2,
  price: new Prisma.Decimal("2574.00"),
  currency: "RUB",
  status: "DELIVERED",
  order: {
    createdAt: new Date("2026-11-17T10:00:00.000Z"),
    pickupPointName: "Central",
    pickupPointAddress: "Tverskaya 12",
    handedOverAt: new Date("2026-11-18T09:00:00.000Z"),
    deliveryAddress: null,
    shippingMethod: { isPickup: true },
  },
  ...over,
});

const aggregateRow = (over: Record<string, unknown> = {}) => ({
  status: "DELIVERED",
  currency: "RUB",
  count: 1,
  units: "2",
  revenue: "5148.00",
  ...over,
});

const read = (
  service: SellerOrderService,
  args: [string, Record<string, unknown>?, unknown?, unknown?],
  rows: unknown[],
  totals: unknown[],
) => {
  prismaMock.orderItem.findMany.mockResolvedValue(rows);
  prismaMock.$queryRaw.mockResolvedValue(totals);

  return service.getSellerOrders(
    args[0],
    args[1] as never,
    args[2],
    args[3],
  );
};

describe("SellerOrderService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    prismaMock.$transaction.mockImplementation(
      (operations: Array<Promise<unknown>>) => Promise.all(operations),
    );
    prismaMock.business.findUnique.mockResolvedValue({ id: "business-1" });
    prismaMock.orderItem.count.mockResolvedValue(0);
    prismaMock.orderItem.findMany.mockResolvedValue([]);
    prismaMock.$queryRaw.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("answers one object with the lines, the counts and the money (AC-1)", async () => {
    prismaMock.orderItem.count.mockResolvedValue(25);

    const result = await read(
      new SellerOrderService(),
      ["seller-1", { status: "DELIVERED" }, "2", "20"],
      [lineRow()],
      [aggregateRow({ count: 25 })],
    );

    expect(result).toMatchObject({
      page: 2,
      limit: 20,
      total: 25,
      totalPages: 2,
      counts: { all: 25, delivered: 25, canceled: 0 },
    });
    expect(result.items).toHaveLength(1);
  });

  it("reads the count, the list and the aggregate in one RepeatableRead transaction (AC-1)", async () => {
    await read(new SellerOrderService(), ["seller-1"], [lineRow()], []);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      [expect.anything(), expect.anything(), expect.anything()],
      {
        maxWait: 5000,
        timeout: 10000,
        isolationLevel: "RepeatableRead",
      },
    );
  });

  it("orders by the parent order date then the line id, over the clamped page (AC-1)", async () => {
    await read(new SellerOrderService(), ["seller-1", {}, "3", "80"], [], []);

    expect(prismaMock.orderItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ order: { createdAt: "desc" } }, { id: "asc" }],
        skip: 100,
        take: 50,
      }),
    );
    expect(prismaMock.orderItem.count).toHaveBeenCalledWith({
      where: { business: { is: { ownerUserId: "seller-1" } } },
    });
  });

  it("carries exactly the documented fields and a server computed subtotal (AC-3)", async () => {
    const result = await read(
      new SellerOrderService(),
      ["seller-1"],
      [lineRow()],
      [aggregateRow()],
    );
    const [item] = result.items;

    expect(Object.keys(item).sort()).toEqual([
      "createdAt",
      "currency",
      "deliveryAddress",
      "handedOverAt",
      "id",
      "isPickup",
      "name",
      "orderId",
      "pickupPointAddress",
      "pickupPointName",
      "previewImage",
      "price",
      "productId",
      "quantity",
      "status",
      "subtotal",
    ]);
    expect(item.price).toBe(2574);
    expect(item.subtotal).toBe(5148);
    expect(item.createdAt).toEqual(new Date("2026-11-17T10:00:00.000Z"));
    expect(item.isPickup).toBe(true);
    expect(item.pickupPointName).toBe("Central");
    expect(item.handedOverAt).toEqual(new Date("2026-11-18T09:00:00.000Z"));
  });

  it("counts every line of the seller and buckets OUT_OF_STOCK as canceled (AC-4)", async () => {
    const result = await read(new SellerOrderService(), ["seller-1"], [], [
      aggregateRow({ status: "DELIVERED", count: 3, units: "7", revenue: "900.00" }),
      aggregateRow({ status: "CANCELLED", count: 2, units: "4", revenue: "800.00" }),
      aggregateRow({ status: "OUT_OF_STOCK", count: 1, units: "1", revenue: "50.00" }),
      aggregateRow({ status: "PENDING", count: 4, units: "6", revenue: "300.00" }),
    ]);

    expect(result.counts).toEqual({ all: 10, delivered: 3, canceled: 3 });
  });

  it("sums revenue and units over delivered lines only, per currency (AC-5)", async () => {
    const result = await read(new SellerOrderService(), ["seller-1"], [], [
      aggregateRow({ status: "DELIVERED", currency: "RUB", units: "7", revenue: "900.40" }),
      aggregateRow({ status: "DELIVERED", currency: "USD", units: "3", revenue: "12.10" }),
      aggregateRow({ status: "CANCELLED", currency: "RUB", units: "9", revenue: "7000.00" }),
    ]);

    expect(result.stats).toEqual({
      revenue: [
        { currency: "RUB", amount: 900.4 },
        { currency: "USD", amount: 12.1 },
      ],
      units: 10,
    });
  });

  it("leaves a currency with no delivered line out of the revenue (AC-5)", async () => {
    const result = await read(new SellerOrderService(), ["seller-1"], [], [
      aggregateRow({ status: "DELIVERED", currency: "RUB", revenue: "100.00" }),
      aggregateRow({ status: "CANCELLED", currency: "USD", revenue: "999.00" }),
    ]);

    expect(result.stats.revenue).toEqual([{ currency: "RUB", amount: 100 }]);
    expect(result.stats.units).toBe(2);
  });

  it("answers an empty revenue array for a shop with no delivered line (AC-5)", async () => {
    const result = await read(new SellerOrderService(), ["seller-1"], [], [
      aggregateRow({ status: "PENDING", currency: "RUB", count: 2, revenue: "0.00" }),
    ]);

    expect(result.stats).toEqual({ revenue: [], units: 0 });
    expect(result.counts).toEqual({ all: 2, delivered: 0, canceled: 0 });
  });

  it("applies the filters to the list and the count, never to the aggregate (AC-2, AC-4)", async () => {
    await read(
      new SellerOrderService(),
      ["seller-1", { status: "CANCELED", q: "drill" }],
      [],
      [],
    );

    const where = {
      business: { is: { ownerUserId: "seller-1" } },
      AND: [
        { status: { in: ["CANCELLED", "OUT_OF_STOCK"] } },
        {
          OR: [
            { name: { contains: "drill", mode: "insensitive" } },
            { orderId: { contains: "drill", mode: "insensitive" } },
          ],
        },
      ],
    };

    expect(prismaMock.orderItem.count).toHaveBeenCalledWith({ where });
    expect(prismaMock.orderItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    const aggregateSql = prismaMock.$queryRaw.mock.calls[0][0] as string[];
    expect(aggregateSql.join("?")).not.toContain("status =");
  });

  it.each(["0", "-1", "1.5", "nope", "9007199254740992"])(
    "rejects invalid page values such as %s (AC-2)",
    async (page) => {
      await expect(
        new SellerOrderService().getSellerOrders("seller-1", {}, page, "20"),
      ).rejects.toMatchObject({ status: 422, code: "VALIDATION" });
    },
  );

  it("rejects users without an assigned business before any read (AC-2)", async () => {
    prismaMock.business.findUnique.mockResolvedValue(null);

    await expect(
      new SellerOrderService().getSellerOrders("seller-1"),
    ).rejects.toMatchObject({ status: 403, code: "SELLER_NOT_ASSIGNED" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("exposes no write on the seller service any more (AC-10)", () => {
    const service = new SellerOrderService() as unknown as Record<
      string,
      unknown
    >;

    expect(service).not.toHaveProperty("handOverOrder");
    expect(service).not.toHaveProperty("updateSellerOrderItemStatus");
  });
});
