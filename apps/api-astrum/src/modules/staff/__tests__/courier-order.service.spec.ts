jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    order: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("../../payment/payment.cancel", () => ({
  expireSessionForCancel: jest.fn(),
}));

import { Prisma } from "@astrum/db/client";
import type {
  OrderItemStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@astrum/db/enums";
import { prisma } from "../../../../lib/prisma";
import { logger } from "../../../common/helpers/logger";
import { expireSessionForCancel } from "../../payment/payment.cancel";
import { CourierOrderService } from "../courier-order.service";

const prismaMock = prisma as unknown as {
  order: { count: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
  $transaction: jest.Mock;
};

const expireMock = expireSessionForCancel as unknown as jest.Mock;

type LineSeed = {
  id: string;
  productId: string;
  status: OrderItemStatus;
  quantity: number;
  price: string;
};

type OrderSeed = {
  id: string;
  userId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  handedOverAt: Date | null;
  grandTotal: string;
  courierUserId: string | null;
  isPickup: boolean;
  deliveryAddress: string | null;
  lines: LineSeed[];
};

const orderSeed = (over: Partial<OrderSeed> = {}): OrderSeed => ({
  id: "order-1",
  userId: "buyer-1",
  status: "SHIPPED",
  paymentStatus: "PENDING",
  paymentMethod: "CASH",
  handedOverAt: null,
  grandTotal: "119.98",
  courierUserId: null,
  isPickup: false,
  deliveryAddress: "Tverskaya 12",
  lines: [
    {
      id: "line-1",
      productId: "product-1",
      status: "SHIPPED",
      quantity: 2,
      price: "19.99",
    },
    {
      id: "line-2",
      productId: "product-2",
      status: "SHIPPED",
      quantity: 1,
      price: "80.00",
    },
  ],
  ...over,
});

const createTx = (seed: OrderSeed | null) => {
  const lines = () => seed?.lines ?? [];

  const row = () =>
    seed === null
      ? null
      : {
          id: seed.id,
          userId: seed.userId,
          createdAt: new Date("2026-11-14T08:30:00.000Z"),
          status: seed.status,
          paymentStatus: seed.paymentStatus,
          paymentMethod: seed.paymentMethod,
          handedOverAt: seed.handedOverAt,
          grandTotal: new Prisma.Decimal(seed.grandTotal),
          currency: "RUB" as const,
          courierUserId: seed.courierUserId,
          deliveryDate: new Date("2026-11-16T09:00:00.000Z"),
          deliveryAddress: seed.deliveryAddress,
          shippingMethod: { isPickup: seed.isPickup },
          OrderItem: lines().map((line) => ({
            id: line.id,
            name: `Product ${line.id}`,
            previewImage: `http://cdn/${line.id}.png`,
            quantity: line.quantity,
            price: new Prisma.Decimal(line.price),
            currency: "RUB" as const,
            status: line.status,
            productId: line.productId,
          })),
        };

  const orderUpdate = jest.fn(
    async ({ data }: { data: Record<string, unknown> }) => {
      if (seed !== null) {
        if (typeof data.courierUserId === "string") {
          seed.courierUserId = data.courierUserId;
        }

        if (data.courierUserId === null) {
          seed.courierUserId = null;
        }

        if (typeof data.status === "string") {
          seed.status = data.status as OrderStatus;
        }

        if (typeof data.paymentStatus === "string") {
          seed.paymentStatus = data.paymentStatus as PaymentStatus;
        }
      }

      return {};
    },
  );

  const orderUpdateMany = jest.fn(
    async ({
      where,
      data,
    }: {
      where: { id: string; handedOverAt?: null };
      data: { handedOverAt?: Date };
    }) => {
      if (seed === null || data.handedOverAt === undefined) {
        return { count: 0 };
      }

      if (where.handedOverAt === null && seed.handedOverAt !== null) {
        return { count: 0 };
      }

      seed.handedOverAt = data.handedOverAt;
      return { count: 1 };
    },
  );

  const lineUpdate = jest.fn(
    async ({
      where,
      data,
    }: {
      where: { id: { in: string[] } };
      data: { status?: OrderItemStatus; receiptDate?: Date };
    }) => {
      const touched = lines().filter((line) => where.id.in.includes(line.id));

      for (const line of touched) {
        if (data.status !== undefined) {
          line.status = data.status;
        }
      }

      return { count: touched.length };
    },
  );

  const stockUpdate = jest.fn().mockResolvedValue({ count: 1 });
  const paymentUpdate = jest.fn().mockResolvedValue({ count: 0 });

  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    order: {
      findUnique: jest.fn(async () => row()),
      findUniqueOrThrow: jest.fn(async () => row()),
      update: orderUpdate,
      updateMany: orderUpdateMany,
    },
    orderItem: {
      findMany: jest.fn(async () => lines().map((line) => ({ status: line.status }))),
      updateMany: lineUpdate,
    },
    product: { updateMany: stockUpdate },
    payment: { updateMany: paymentUpdate },
  };

  prismaMock.$transaction.mockImplementation(
    async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
  );
  // The ownership read before a cancel runs outside the transaction.
  prismaMock.order.findUnique.mockImplementation(async () =>
    seed === null
      ? null
      : {
          courierUserId: seed.courierUserId,
          shippingMethod: { isPickup: seed.isPickup },
        },
  );

  return { tx, orderUpdate, orderUpdateMany, lineUpdate, stockUpdate, paymentUpdate };
};

const runWithSeed = async (seed: OrderSeed | null) => {
  const created = createTx(seed);
  return created;
};

describe("CourierOrderService", () => {
  const service = new CourierOrderService();
  const courier = "courier-1";

  beforeEach(() => {
    jest.clearAllMocks();
    expireMock.mockResolvedValue(undefined);
  });

  describe("listCourierOrders", () => {
    const listed = (seed: OrderSeed) => ({
      id: seed.id,
      createdAt: new Date("2026-11-14T08:30:00.000Z"),
      status: seed.status,
      paymentStatus: seed.paymentStatus,
      paymentMethod: seed.paymentMethod,
      handedOverAt: seed.handedOverAt,
      grandTotal: new Prisma.Decimal(seed.grandTotal),
      currency: "RUB" as const,
      courierUserId: seed.courierUserId,
      deliveryDate: new Date("2026-11-16T09:00:00.000Z"),
      deliveryAddress: seed.deliveryAddress,
      userId: seed.userId,
      shippingMethodId: "ship-1",
      OrderItem: [
        {
          id: "line-1",
          name: "Drill",
          previewImage: "http://cdn/drill.png",
          quantity: 2,
          price: new Prisma.Decimal("19.99"),
          currency: "RUB" as const,
          status: "SHIPPED" as const,
          productId: "product-1",
          userId: seed.userId,
        },
      ],
    });

    it("reads the pool as shipped courier parcels nobody took (AC-2, AC-3)", async () => {
      prismaMock.order.count.mockResolvedValue(1);
      prismaMock.order.findMany.mockResolvedValue([
        listed(orderSeed({ courierUserId: null })),
      ]);

      const answer = await service.listCourierOrders(courier, "available");

      expect(prismaMock.order.findMany).toHaveBeenCalledWith({
        where: {
          status: "SHIPPED",
          shippingMethod: { isPickup: false },
          courierUserId: null,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: 0,
        take: 20,
        select: expect.any(Object),
      });
      expect(answer.page).toBe(1);
      expect(answer.limit).toBe(20);
      expect(answer.total).toBe(1);
      expect(answer.totalPages).toBe(1);
      expect(answer.orders[0].deliveryAddress).toBeNull();
    });

    it("reads only the caller's own parcels on the mine scope, with the address (AC-2, AC-3)", async () => {
      prismaMock.order.count.mockResolvedValue(1);
      prismaMock.order.findMany.mockResolvedValue([
        listed(orderSeed({ courierUserId: courier })),
      ]);

      const answer = await service.listCourierOrders(courier, "mine");

      expect(prismaMock.order.findMany.mock.calls[0][0].where.courierUserId).toBe(
        courier,
      );
      expect(answer.orders[0].deliveryAddress).toBe("Tverskaya 12");
      expect(expireMock).not.toHaveBeenCalled();
    });

    it("answers no buyer field on any row (AC-3)", async () => {
      prismaMock.order.count.mockResolvedValue(1);
      prismaMock.order.findMany.mockResolvedValue([
        listed(orderSeed({ courierUserId: courier })),
      ]);

      const answer = await service.listCourierOrders(courier, "mine");
      const row = answer.orders[0] as unknown as Record<string, unknown>;
      const line = row.orderItems as Record<string, unknown>[];

      expect(row).not.toHaveProperty("userId");
      expect(row).not.toHaveProperty("pickupPointId");
      expect(row).not.toHaveProperty("shippingMethodId");
      expect(line[0]).not.toHaveProperty("userId");
      expect(line[0]).not.toHaveProperty("productId");
      expect(row.grandTotal).toBe(119.98);
      expect(line[0].price).toBe(19.99);
    });

    it("answers an empty page in the same shape (AC-2)", async () => {
      prismaMock.order.count.mockResolvedValue(0);
      prismaMock.order.findMany.mockResolvedValue([]);

      await expect(
        service.listCourierOrders(courier, "available"),
      ).resolves.toEqual({
        orders: [],
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });

    it("clamps the limit to 50 and refuses a limit that is not a number (AC-2)", async () => {
      prismaMock.order.count.mockResolvedValue(0);
      prismaMock.order.findMany.mockResolvedValue([]);

      await service.listCourierOrders(courier, "available", undefined, "500");
      expect(prismaMock.order.findMany.mock.calls[0][0].take).toBe(50);

      await expect(
        service.listCourierOrders(courier, "available", "two"),
      ).rejects.toMatchObject({ status: 422, code: "VALIDATION" });
    });

    it("skips the pages it already read (AC-2)", async () => {
      prismaMock.order.count.mockResolvedValue(21);
      prismaMock.order.findMany.mockResolvedValue([]);

      const answer = await service.listCourierOrders(
        courier,
        "available",
        "2",
        "20",
      );

      expect(prismaMock.order.findMany.mock.calls[0][0].skip).toBe(20);
      expect(answer.totalPages).toBe(2);
    });
  });

  describe("claim", () => {
    it("writes the caller on a free parcel and answers it with its address (AC-4)", async () => {
      const seed = orderSeed();
      await runWithSeed(seed);
      const info = jest.spyOn(logger, "info").mockImplementation(() => undefined);

      const answer = await service.claim(seed.id, courier);

      expect(seed.courierUserId).toBe(courier);
      expect(answer.order.deliveryAddress).toBe("Tverskaya 12");
      expect(answer.order.courierUserId).toBe(courier);
      expect(info).toHaveBeenCalledWith({
        event: "staff.courier.claimed",
        userId: courier,
        orderId: seed.id,
        resultCode: "OK",
      });
      info.mockRestore();
    });

    it("answers the same row on a second press without writing or logging (AC-4)", async () => {
      const seed = orderSeed({ courierUserId: courier });
      const { orderUpdate } = await runWithSeed(seed);
      const info = jest.spyOn(logger, "info").mockImplementation(() => undefined);

      const answer = await service.claim(seed.id, courier);

      expect(orderUpdate).not.toHaveBeenCalled();
      expect(info).not.toHaveBeenCalled();
      expect(answer.order.id).toBe(seed.id);
      info.mockRestore();
    });

    it("answers a counter parcel and a missing one with the same not found (AC-4)", async () => {
      const pickup = orderSeed({ isPickup: true });

      createTx(pickup);

      await expect(
        service.claim(pickup.id, courier),
      ).rejects.toMatchObject({ status: 404, code: "ORDER_NOT_FOUND" });

      createTx(null);

      await expect(
        service.claim("missing", courier),
      ).rejects.toMatchObject({ status: 404, code: "ORDER_NOT_FOUND" });
    });

    it("refuses a parcel another courier took (AC-4)", async () => {
      const seed = orderSeed({ courierUserId: "courier-2" });
      createTx(seed);

      await expect(
        service.claim(seed.id, courier),
      ).rejects.toMatchObject({ status: 409, code: "ALREADY_CLAIMED" });
      expect(seed.courierUserId).toBe("courier-2");
    });

    it("refuses a parcel already handed over (AC-4)", async () => {
      const seed = orderSeed({
        handedOverAt: new Date("2026-11-14T10:00:00.000Z"),
        status: "DELIVERED",
        courierUserId: courier,
      });
      createTx(seed);

      await expect(
        service.claim(seed.id, courier),
      ).rejects.toMatchObject({ status: 409, code: "ALREADY_HANDED_OVER" });
    });

    it("refuses a parcel that is not sent yet (AC-4)", async () => {
      const seed = orderSeed({ status: "CONFIRMED" });
      createTx(seed);

      await expect(
        service.claim(seed.id, courier),
      ).rejects.toMatchObject({ status: 409, code: "ORDER_NOT_SHIPPED" });
    });
  });

  describe("release", () => {
    it("clears the caller and answers the row with no address (AC-5)", async () => {
      const seed = orderSeed({ courierUserId: courier });
      await runWithSeed(seed);

      const answer = await service.release(seed.id, courier);

      expect(seed.courierUserId).toBeNull();
      expect(answer.order.deliveryAddress).toBeNull();
    });

    it("answers not found on a second press (AC-5)", async () => {
      const seed = orderSeed();
      createTx(seed);

      await expect(
        service.release(seed.id, courier),
      ).rejects.toMatchObject({ status: 404, code: "ORDER_NOT_FOUND" });
    });

    it("answers not found on a parcel another courier holds (AC-5)", async () => {
      const seed = orderSeed({ courierUserId: "courier-2" });
      createTx(seed);

      await expect(
        service.release(seed.id, courier),
      ).rejects.toMatchObject({ status: 404, code: "ORDER_NOT_FOUND" });
      expect(seed.courierUserId).toBe("courier-2");
    });

    it("refuses a parcel already handed over (AC-5)", async () => {
      const seed = orderSeed({
        courierUserId: courier,
        handedOverAt: new Date("2026-11-14T10:00:00.000Z"),
        status: "DELIVERED",
      });
      createTx(seed);

      await expect(
        service.release(seed.id, courier),
      ).rejects.toMatchObject({ status: 409, code: "ALREADY_HANDED_OVER" });
    });
  });

  describe("handOver", () => {
    beforeEach(() => {
      jest.spyOn(logger, "info").mockImplementation(() => undefined);
      jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("delivers every shipped line with one timestamp and stamps the order once (AC-6)", async () => {
      const seed = orderSeed({ courierUserId: courier });
      const { lineUpdate, orderUpdateMany } = await runWithSeed(seed);

      const answer = await service.handOver(seed.id, courier);

      expect(lineUpdate).toHaveBeenCalledWith({
        where: { id: { in: ["line-1", "line-2"] } },
        data: { status: "DELIVERED", receiptDate: expect.any(Date) },
      });
      expect(orderUpdateMany).toHaveBeenCalledWith({
        where: { id: seed.id, handedOverAt: null },
        data: { handedOverAt: expect.any(Date) },
      });

      const receipt = lineUpdate.mock.calls[0][0].data.receiptDate as Date;
      const stamp = orderUpdateMany.mock.calls[0][0].data.handedOverAt as Date;

      // One server timestamp feeds both the lines and the order.
      expect(receipt).toEqual(stamp);
      expect(seed.status).toBe("DELIVERED");
      expect(seed.handedOverAt).toEqual(stamp);
      expect(answer.order.status).toBe("DELIVERED");
      expect(answer.order.courierUserId).toBe(courier);
      expect(answer.order.deliveryAddress).toBe("Tverskaya 12");
    });

    it("records the money of a cash parcel (AC-7)", async () => {
      const seed = orderSeed({ courierUserId: courier, paymentMethod: "CASH" });
      await runWithSeed(seed);

      await service.handOver(seed.id, courier);

      expect(seed.paymentStatus).toBe("PAID");
      expect(logger.info).toHaveBeenCalledWith({
        event: "staff.courier.handed_over",
        userId: courier,
        orderId: seed.id,
        deliveredLineCount: 2,
        resultCode: "OK",
        collectedAmount: "119.98",
        collectedCurrency: "RUB",
      });
    });

    it("records the money of a card on delivery parcel too (AC-7)", async () => {
      const seed = orderSeed({
        courierUserId: courier,
        paymentMethod: "CARD_ON_DELIVERY",
      });
      await runWithSeed(seed);

      await service.handOver(seed.id, courier);

      expect(seed.paymentStatus).toBe("PAID");
    });

    it("leaves a parcel already paid untouched (AC-7)", async () => {
      const seed = orderSeed({
        courierUserId: courier,
        paymentStatus: "PAID",
      });
      await runWithSeed(seed);

      await service.handOver(seed.id, courier);

      expect(seed.paymentStatus).toBe("PAID");

      const line = (logger.info as jest.Mock).mock.calls[0][0] as Record<
        string,
        unknown
      >;

      expect(line).not.toHaveProperty("collectedAmount");
    });

    it("leaves an online parcel reading pending untouched (AC-7)", async () => {
      const seed = orderSeed({
        courierUserId: courier,
        paymentMethod: "ONLINE_CARD",
        paymentStatus: "PENDING",
      });
      await runWithSeed(seed);

      await service.handOver(seed.id, courier);

      expect(seed.paymentStatus).toBe("PENDING");
    });

    it("refuses a missing order, a counter parcel, a free one and a foreign one with not found (AC-6)", async () => {
      createTx(null);
      await expect(
        service.handOver("missing", courier),
      ).rejects.toMatchObject({ status: 404, code: "ORDER_NOT_FOUND" });

      createTx(orderSeed({ isPickup: true }));
      await expect(
        service.handOver("order-1", courier),
      ).rejects.toMatchObject({ status: 404, code: "ORDER_NOT_FOUND" });

      createTx(orderSeed());
      await expect(
        service.handOver("order-1", courier),
      ).rejects.toMatchObject({ status: 404, code: "ORDER_NOT_FOUND" });

      createTx(orderSeed({ courierUserId: "courier-2" }));
      await expect(
        service.handOver("order-1", courier),
      ).rejects.toMatchObject({ status: 404, code: "ORDER_NOT_FOUND" });
    });

    it("refuses a second press and a parcel that is not sent yet (AC-6)", async () => {
      createTx(
        orderSeed({
          courierUserId: courier,
          handedOverAt: new Date("2026-11-14T10:00:00.000Z"),
          status: "DELIVERED",
        }),
      );
      await expect(
        service.handOver("order-1", courier),
      ).rejects.toMatchObject({ status: 409, code: "ALREADY_HANDED_OVER" });

      createTx(orderSeed({ courierUserId: courier, status: "CONFIRMED" }));
      await expect(
        service.handOver("order-1", courier),
      ).rejects.toMatchObject({ status: 409, code: "ORDER_NOT_SHIPPED" });
    });

    it("writes the refusal line with its code (AC-6)", async () => {
      createTx(orderSeed());
      await expect(service.handOver("order-1", courier)).rejects.toBeDefined();

      expect(logger.warn).toHaveBeenCalledWith({
        event: "staff.courier.handover_refused",
        userId: courier,
        orderId: "order-1",
        resultCode: "ORDER_NOT_FOUND",
      });
    });
  });

  describe("cancelOrder", () => {
    beforeEach(() => {
      jest.spyOn(logger, "info").mockImplementation(() => undefined);
      jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("cancels every cancellable line and returns its stock once (AC-8)", async () => {
      const seed = orderSeed({ courierUserId: courier });
      const { lineUpdate, stockUpdate } = await runWithSeed(seed);

      await service.cancelOrder(seed.id, courier);

      expect(expireMock).toHaveBeenCalledWith(seed.id);
      expect(lineUpdate).toHaveBeenCalledWith({
        where: { id: { in: ["line-1", "line-2"] } },
        data: { status: "CANCELLED" },
      });
      expect(stockUpdate).toHaveBeenCalledTimes(2);
      expect(seed.status).toBe("CANCELED");
      expect(seed.paymentStatus).toBe("CANCELLED");
    });

    it("leaves a delivered line alone and recomputes the order to delivered (AC-8)", async () => {
      const seed = orderSeed({
        courierUserId: courier,
        lines: [
          {
            id: "line-1",
            productId: "product-1",
            status: "DELIVERED",
            quantity: 2,
            price: "19.99",
          },
          {
            id: "line-2",
            productId: "product-2",
            status: "SHIPPED",
            quantity: 1,
            price: "80.00",
          },
        ],
      });
      await runWithSeed(seed);

      await service.cancelOrder(seed.id, courier);

      expect(seed.lines[0].status).toBe("DELIVERED");
      expect(seed.lines[1].status).toBe("CANCELLED");
      expect(seed.status).toBe("DELIVERED");
    });

    it("refuses a second press with nothing to cancel (AC-8)", async () => {
      const seed = orderSeed({
        courierUserId: courier,
        status: "DELIVERED",
        lines: [
          {
            id: "line-1",
            productId: "product-1",
            status: "DELIVERED",
            quantity: 2,
            price: "19.99",
          },
        ],
      });
      createTx(seed);

      await expect(
        service.cancelOrder(seed.id, courier),
      ).rejects.toMatchObject({ status: 409, code: "NOTHING_TO_CANCEL" });
    });

    it("keeps a paid order paid and leaves one refund warning naming the actor and the buyer (AC-8)", async () => {
      const seed = orderSeed({
        courierUserId: courier,
        paymentStatus: "PAID",
      });
      await runWithSeed(seed);

      await service.cancelOrder(seed.id, courier);

      expect(seed.paymentStatus).toBe("PAID");
      expect(logger.warn).toHaveBeenCalledWith({
        event: "payment.refund_owed",
        reason: "courier_cancel",
        orderId: seed.id,
        buyerUserId: "buyer-1",
        actorUserId: courier,
        amount: "119.98",
        currency: "RUB",
        cancelledLineCount: 2,
      });
    });

    it("refuses an unclaimed, a foreign and a counter parcel before anything is written (AC-8)", async () => {
      for (const seed of [
        orderSeed(),
        orderSeed({ courierUserId: "courier-2" }),
        orderSeed({ courierUserId: courier, isPickup: true }),
      ]) {
        createTx(seed);

        await expect(
          service.cancelOrder(seed.id, courier),
        ).rejects.toMatchObject({ status: 404, code: "ORDER_NOT_FOUND" });
      }

      expect(expireMock).not.toHaveBeenCalled();
    });
  });
});
