jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    business: { findUnique: jest.fn() },
    order: { findMany: jest.fn() },
  },
}));

import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { logger } from "../../../common/helpers/logger";
import { ORDER_TRANSACTION_OPTIONS } from "../order-status.helpers";
import { SellerOrderService } from "../seller-order.service";

const prismaMock = prisma as unknown as {
  $transaction: jest.Mock;
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

const setTransaction = (current: ReturnType<typeof sellerLine> | null) => {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: "order-1" }]),
    orderItem: {
      findUnique: jest
        .fn()
        .mockResolvedValue(current ? { orderId: current.orderId } : null),
      findFirst: jest.fn().mockResolvedValue(current),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: { status: string } }) =>
          Promise.resolve({ ...current, ...data }),
        ),
      findMany: jest
        .fn()
        .mockImplementation(() => Promise.resolve([{ status: "CONFIRMED" }])),
    },
    product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    order: {
      update: jest.fn().mockResolvedValue({}),
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ paymentStatus: "PENDING" }),
    },
  };

  prismaMock.$transaction.mockImplementation(
    (callback: (client: typeof tx) => unknown) => callback(tx),
  );
  return tx;
};

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

  it("cancels an owned line and derives its parent order status (AC-5, AC-6, AC-11)", async () => {
    const tx = setTransaction(sellerLine("CONFIRMED"));
    const info = jest.spyOn(logger, "info").mockImplementation(() => undefined);
    tx.orderItem.findMany.mockResolvedValue([{ status: "CANCELLED" }]);
    const result = await new SellerOrderService().updateSellerOrderItemStatus(
      "line-1",
      "seller-1",
      "CANCELLED",
    );

    expect(result.status).toBe("CANCELLED");
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.orderItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "line-1" },
        data: { status: "CANCELLED" },
      }),
    );
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "CANCELED" },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      ORDER_TRANSACTION_OPTIONS,
    );
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "seller.order_item.status_changed",
        userId: "seller-1",
        orderId: "order-1",
        orderItemId: "line-1",
        targetStatus: "CANCELLED",
        resultCode: "OK",
      }),
    );
    const loggedFields = info.mock.calls[0][0];
    expect(loggedFields).not.toHaveProperty("deliveryAddress");
    expect(loggedFields).not.toHaveProperty("paymentDetails");
  });

  it("writes the refund warning when a paid line is cancelled (AC-6)", async () => {
    const tx = setTransaction(sellerLine("CONFIRMED"));
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    tx.orderItem.update.mockResolvedValue(sellerLine("CANCELLED"));
    tx.order.findUniqueOrThrow.mockResolvedValue({ paymentStatus: "PAID" });

    await new SellerOrderService().updateSellerOrderItemStatus(
      "line-1",
      "seller-1",
      "CANCELLED",
    );

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "payment.refund_owed",
        orderId: "order-1",
        orderItemId: "line-1",
        amount: "39.98",
        currency: "RUB",
      }),
    );
  });

  it("writes no refund warning when an unpaid line is cancelled (AC-6)", async () => {
    const tx = setTransaction(sellerLine("CONFIRMED"));
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    tx.orderItem.update.mockResolvedValue(sellerLine("CANCELLED"));

    await new SellerOrderService().updateSellerOrderItemStatus(
      "line-1",
      "seller-1",
      "CANCELLED",
    );

    expect(warn).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: "payment.refund_owed" }),
    );
  });

  it("refuses the moves the platform took over (AC-5)", async () => {
    for (const [from, to] of [
      ["PENDING", "CONFIRMED"],
      ["CONFIRMED", "SHIPPED"],
      ["PENDING", "OUT_OF_STOCK"],
    ] as const) {
      const tx = setTransaction(sellerLine(from));

      await expect(
        new SellerOrderService().updateSellerOrderItemStatus(
          "line-1",
          "seller-1",
          to,
        ),
      ).rejects.toMatchObject({
        status: 409,
        code: "INVALID_STATUS_TRANSITION",
        details: { from, to },
      });

      expect(tx.orderItem.update).not.toHaveBeenCalled();
    }
  });

  it("returns stock only once when an owned line is cancelled (AC-9)", async () => {
    const tx = setTransaction(sellerLine("CONFIRMED"));
    tx.orderItem.findFirst
      .mockResolvedValueOnce(sellerLine("CONFIRMED"))
      .mockResolvedValueOnce(sellerLine("CANCELLED"));
    tx.orderItem.update.mockResolvedValue(sellerLine("CANCELLED"));
    tx.orderItem.findMany.mockResolvedValue([{ status: "CANCELLED" }]);

    await new SellerOrderService().updateSellerOrderItemStatus(
      "line-1",
      "seller-1",
      "CANCELLED",
    );
    await new SellerOrderService().updateSellerOrderItemStatus(
      "line-1",
      "seller-1",
      "CANCELLED",
    );

    expect(tx.product.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: "product-1" },
      data: { quantity: { increment: 2 }, isOutOfStock: false },
    });
  });

  it("rejects a disallowed line transition without writes (AC-6, AC-7)", async () => {
    const tx = setTransaction(sellerLine("PENDING"));

    await expect(
      new SellerOrderService().updateSellerOrderItemStatus(
        "line-1",
        "seller-1",
        "CONFIRMED",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "INVALID_STATUS_TRANSITION",
      details: { from: "PENDING", to: "CONFIRMED" },
    });

    expect(tx.orderItem.update).not.toHaveBeenCalled();
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("hides another seller's line as not found and logs no private data (AC-7, AC-14)", async () => {
    const tx = setTransaction(null);
    tx.orderItem.findUnique.mockResolvedValue({ orderId: "order-1" });
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);

    await expect(
      new SellerOrderService().updateSellerOrderItemStatus(
        "line-1",
        "other-seller",
        "CONFIRMED",
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "ORDER_ITEM_NOT_FOUND",
    });
    expect(tx.orderItem.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "seller.order_item.status_refused",
        userId: "other-seller",
        orderId: "order-1",
        orderItemId: "line-1",
        targetStatus: "CONFIRMED",
        resultCode: "ORDER_ITEM_NOT_FOUND",
      }),
    );
    const loggedFields = warn.mock.calls[0][0];
    expect(loggedFields).not.toHaveProperty("deliveryAddress");
    expect(loggedFields).not.toHaveProperty("paymentDetails");
  });

  it("logs a null order id when the requested line is missing (AC-14)", async () => {
    const tx = setTransaction(null);
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);

    await expect(
      new SellerOrderService().updateSellerOrderItemStatus(
        "missing-line",
        "seller-1",
        "CONFIRMED",
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "ORDER_ITEM_NOT_FOUND",
    });

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: null,
        orderItemId: "missing-line",
        resultCode: "ORDER_ITEM_NOT_FOUND",
      }),
    );
  });
});
