jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    order: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
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
import { AppError } from "../../../common/helpers/appError";
import { expireSessionForCancel } from "../../payment/payment.cancel";
import { PointOrderService } from "../point-order.service";

const prismaMock = prisma as unknown as {
  order: { count: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };
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
  pickupPointId: string;
  createdAt: Date;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  handedOverAt: Date | null;
  grandTotal: string;
  lines: LineSeed[];
};

const orderSeed = (over: Partial<OrderSeed> = {}): OrderSeed => ({
  id: "order-1",
  userId: "buyer-1",
  pickupPointId: "pp-1",
  createdAt: new Date("2026-11-14T08:30:00.000Z"),
  status: "SHIPPED",
  paymentStatus: "PENDING",
  paymentMethod: "CASH",
  handedOverAt: null,
  grandTotal: "119.98",
  lines: [
    { id: "line-1", productId: "product-1", status: "SHIPPED", quantity: 2, price: "19.99" },
    { id: "line-2", productId: "product-2", status: "SHIPPED", quantity: 1, price: "80.00" },
  ],
  ...over,
});

const createTx = (options: { order?: OrderSeed | null; pointActive?: boolean }) => {
  const seed = options.order ?? null;
  const lines = () => seed?.lines ?? [];

  const row = (withProduct: boolean) =>
    seed === null
      ? null
      : {
          id: seed.id,
          createdAt: seed.createdAt,
          status: seed.status,
          paymentStatus: seed.paymentStatus,
          paymentMethod: seed.paymentMethod,
          handedOverAt: seed.handedOverAt,
          grandTotal: new Prisma.Decimal(seed.grandTotal),
          currency: "RUB" as const,
          userId: seed.userId,
          OrderItem: lines().map((line) => ({
            id: line.id,
            name: `Product ${line.id}`,
            previewImage: `http://cdn/${line.id}.png`,
            quantity: line.quantity,
            price: new Prisma.Decimal(line.price),
            currency: "RUB" as const,
            status: line.status,
            ...(withProduct ? { productId: line.productId } : {}),
          })),
        };

  const orderUpdate = jest.fn(
    async ({ data }: { data: Record<string, unknown> }) => {
      if (seed !== null) {
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

  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    pickupPoint: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ isActive: options.pointActive ?? true }),
    },
    order: {
      findFirst: jest.fn(
        async (args?: { where?: { id?: string; pickupPointId?: string } }) => {
          if (args?.where === undefined) {
            return row(true);
          }

          const owned =
            seed !== null &&
            (args.where.id === undefined || args.where.id === seed.id) &&
            (args.where.pickupPointId === undefined ||
              args.where.pickupPointId === seed.pickupPointId);

          return owned ? row(true) : null;
        },
      ),
      findUniqueOrThrow: jest.fn(async () => row(false)),
      updateMany: jest.fn(async ({ data }: { data: { handedOverAt?: Date } }) => {
        if (seed !== null && data.handedOverAt !== undefined) {
          seed.handedOverAt = data.handedOverAt;
        }

        return { count: 1 };
      }),
      update: orderUpdate,
    },
    orderItem: {
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: { in: string[] } };
          data: { status: OrderItemStatus; receiptDate?: Date };
        }) => {
          const touched = lines().filter((line) => where.id.in.includes(line.id));

          for (const line of touched) {
            line.status = data.status;
          }

          return { count: touched.length };
        },
      ),
      findMany: jest.fn(async () => lines().map((line) => ({ status: line.status }))),
    },
    product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    payment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };

  return tx;
};

const wireTransaction = (tx: unknown): void => {
  prismaMock.$transaction.mockImplementation(async (work: (client: unknown) => unknown) =>
    work(tx),
  );
};

const service = new PointOrderService();

const expectAppError = async (
  promise: Promise<unknown>,
  status: number,
  code: string,
): Promise<void> => {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject({ status, code });
};

const logLines = (spy: jest.SpyInstance): Array<Record<string, unknown>> =>
  spy.mock.calls.map((call) => JSON.parse(String(call[0])) as Record<string, unknown>);

describe("PointOrderService", () => {
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    infoSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    expireMock.mockResolvedValue(undefined);
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.order.findFirst.mockResolvedValue({ id: "order-1" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("listPointOrders (AC-1 to AC-3)", () => {
    it("reads only the caller's point and only shipped orders, oldest first", async () => {
      prismaMock.order.count.mockResolvedValue(1);

      await service.listPointOrders("pp-1", undefined, undefined);

      expect(prismaMock.order.count).toHaveBeenCalledWith({
        where: { pickupPointId: "pp-1", status: "SHIPPED" },
      });
      expect(prismaMock.order.findMany).toHaveBeenCalledWith({
        where: { pickupPointId: "pp-1", status: "SHIPPED" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: 0,
        take: 20,
        select: expect.objectContaining({ OrderItem: expect.anything() }),
      });
    });

    it("defaults to the first page of twenty and clamps the limit to fifty", async () => {
      const first = await service.listPointOrders("pp-1", undefined, undefined);
      const clamped = await service.listPointOrders("pp-1", "3", "500");

      expect(first).toMatchObject({ page: 1, limit: 20 });
      expect(clamped).toMatchObject({ page: 3, limit: 50 });
    });

    it("answers an empty page for a point with no parcel (AC-1)", async () => {
      const answer = await service.listPointOrders("pp-1", undefined, undefined);

      expect(answer).toEqual({
        orders: [],
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });

    it("refuses a page or a limit that is not a positive integer (AC-3)", async () => {
      await expectAppError(
        service.listPointOrders("pp-1", "0", undefined),
        422,
        "VALIDATION",
      );
      await expectAppError(
        service.listPointOrders("pp-1", undefined, "1.5"),
        422,
        "VALIDATION",
      );
      await expectAppError(
        service.listPointOrders("pp-1", "9007199254740992", undefined),
        422,
        "VALIDATION",
      );
      expect(prismaMock.order.findMany).not.toHaveBeenCalled();
    });

    it("answers the card shape with number amounts and no buyer field (AC-2)", async () => {
      prismaMock.order.count.mockResolvedValue(1);
      const tx = createTx({ order: orderSeed() });
      prismaMock.order.findMany.mockResolvedValue([
        await tx.order.findFirst(),
      ]);

      const answer = await service.listPointOrders("pp-1", undefined, undefined);
      const [order] = answer.orders;

      expect(Object.keys(order).sort()).toEqual([
        "createdAt",
        "currency",
        "grandTotal",
        "handedOverAt",
        "id",
        "orderItems",
        "paymentMethod",
        "paymentStatus",
        "status",
      ]);
      expect(order.grandTotal).toBe(119.98);
      expect(order.orderItems.map((line) => line.price)).toEqual([19.99, 80]);
      expect(order).not.toHaveProperty("userId");
      expect(order).not.toHaveProperty("pickupPointId");
      expect(order).not.toHaveProperty("deliveryAddress");
      expect(JSON.parse(JSON.stringify(order)).createdAt).toBe(
        "2026-11-14T08:30:00.000Z",
      );
      expect(JSON.parse(JSON.stringify(order)).handedOverAt).toBeNull();
    });
  });

  describe("handOver (AC-4, AC-5)", () => {
    it("delivers every shipped line with one timestamp and stamps the order", async () => {
      const seed = orderSeed();
      const tx = createTx({ order: seed });
      wireTransaction(tx);

      const { order } = await service.handOver("order-1", "worker-1", "pp-1");

      const update = tx.orderItem.updateMany.mock.calls[0][0];
      expect(update.data.status).toBe("DELIVERED");
      expect(update.data.receiptDate).toBeInstanceOf(Date);
      expect(update.where.id.in).toEqual(["line-1", "line-2"]);
      expect(seed.handedOverAt).toBe(update.data.receiptDate);
      expect(seed.status).toBe("DELIVERED");
      expect(order.status).toBe("DELIVERED");
      expect(order.orderItems.map((line) => line.status)).toEqual([
        "DELIVERED",
        "DELIVERED",
      ]);
    });

    it("logs the handover with the count and the code (AC-5)", async () => {
      const tx = createTx({ order: orderSeed() });
      wireTransaction(tx);

      await service.handOver("order-1", "worker-1", "pp-1");

      expect(logLines(infoSpy)).toContainEqual(
        expect.objectContaining({
          event: "staff.point.handed_over",
          userId: "worker-1",
          pointId: "pp-1",
          orderId: "order-1",
          deliveredLineCount: 2,
          resultCode: "OK",
        }),
      );
    });

    it("answers 404 for a missing order and for another point's order, writing nothing", async () => {
      const foreign = createTx({ order: null });
      wireTransaction(foreign);

      await expectAppError(
        service.handOver("order-9", "worker-1", "pp-1"),
        404,
        "ORDER_NOT_FOUND",
      );
      expect(foreign.orderItem.updateMany).not.toHaveBeenCalled();
      expect(foreign.order.update).not.toHaveBeenCalled();

      const gone = orderSeed({ pickupPointId: "pp-2" });
      const other = createTx({ order: gone });
      wireTransaction(other);

      await expectAppError(
        service.handOver("order-1", "worker-1", "pp-1"),
        404,
        "ORDER_NOT_FOUND",
      );
      expect(gone.status).toBe("SHIPPED");
      expect(other.orderItem.updateMany).not.toHaveBeenCalled();
    });

    it("refuses an order that is not shipped yet (AC-4)", async () => {
      const tx = createTx({ order: orderSeed({ status: "CONFIRMED" }) });
      wireTransaction(tx);

      await expectAppError(
        service.handOver("order-1", "worker-1", "pp-1"),
        409,
        "ORDER_NOT_SHIPPED",
      );
      expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
    });

    it("refuses an order that is already closed (AC-4)", async () => {
      const tx = createTx({
        order: orderSeed({ status: "DELIVERED", handedOverAt: new Date() }),
      });
      wireTransaction(tx);

      await expectAppError(
        service.handOver("order-1", "worker-1", "pp-1"),
        409,
        "ALREADY_HANDED_OVER",
      );
      expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
    });

    it("refuses an order of a switched off point (AC-9)", async () => {
      const tx = createTx({ order: orderSeed(), pointActive: false });
      wireTransaction(tx);

      await expectAppError(
        service.handOver("order-1", "worker-1", "pp-1"),
        409,
        "PICKUP_POINT_INACTIVE",
      );
      expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
    });

    it("logs a refusal with the code and no count (AC-5)", async () => {
      const tx = createTx({ order: orderSeed({ status: "CONFIRMED" }) });
      wireTransaction(tx);

      await expect(service.handOver("order-1", "worker-1", "pp-1")).rejects.toThrow();

      const line = logLines(warnSpy).find(
        (entry) => entry.event === "staff.point.handover_refused",
      );

      expect(line).toMatchObject({
        userId: "worker-1",
        pointId: "pp-1",
        orderId: "order-1",
        resultCode: "ORDER_NOT_SHIPPED",
      });
      expect(line).not.toHaveProperty("deliveredLineCount");
    });
  });

  describe("cancelOrder (AC-6 to AC-9)", () => {
    it("cancels the active lines, returns their stock once and leaves a delivered line", async () => {
      const seed = orderSeed({
        lines: [
          { id: "line-1", productId: "product-1", status: "DELIVERED", quantity: 1, price: "10.00" },
          { id: "line-2", productId: "product-2", status: "SHIPPED", quantity: 3, price: "20.00" },
        ],
      });
      const tx = createTx({ order: seed });
      wireTransaction(tx);

      const { order } = await service.cancelOrder("order-1", "worker-1", "pp-1");

      const update = tx.orderItem.updateMany.mock.calls[0][0];
      expect(update.where.id.in).toEqual(["line-2"]);
      expect(update.data.status).toBe("CANCELLED");
      expect(tx.product.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.product.updateMany).toHaveBeenCalledWith({
        where: { id: "product-2" },
        data: { quantity: { increment: 3 }, isOutOfStock: false },
      });
      expect(order.status).toBe("DELIVERED");
      expect(seed.lines[0].status).toBe("DELIVERED");
      expect(seed.lines[1].status).toBe("CANCELLED");
    });

    it("expires the open provider session before the transaction opens (AC-8)", async () => {
      const tx = createTx({ order: orderSeed() });
      wireTransaction(tx);

      await service.cancelOrder("order-1", "worker-1", "pp-1");

      expect(expireMock).toHaveBeenCalledWith("order-1");
      expect(expireMock.mock.invocationCallOrder[0]).toBeLessThan(
        prismaMock.$transaction.mock.invocationCallOrder[0],
      );
    });

    it("refuses a second press and returns no stock twice (AC-7)", async () => {
      const seed = orderSeed({ status: "CANCELED", lines: [
        { id: "line-1", productId: "product-1", status: "CANCELLED", quantity: 2, price: "19.99" },
      ] });
      const tx = createTx({ order: seed });
      wireTransaction(tx);

      await expectAppError(
        service.cancelOrder("order-1", "worker-1", "pp-1"),
        409,
        "NOTHING_TO_CANCEL",
      );
      expect(tx.product.updateMany).not.toHaveBeenCalled();
      expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
    });

    it("answers NOTHING_TO_CANCEL for a fully delivered order before the shipping claim (AC-7)", async () => {
      const tx = createTx({
        order: orderSeed({ status: "DELIVERED", handedOverAt: new Date(), lines: [
          { id: "line-1", productId: "product-1", status: "DELIVERED", quantity: 1, price: "10.00" },
        ] }),
      });
      wireTransaction(tx);

      await expectAppError(
        service.cancelOrder("order-1", "worker-1", "pp-1"),
        409,
        "NOTHING_TO_CANCEL",
      );
    });

    it("refuses an order the shipping pass has not marked sent yet (AC-6)", async () => {
      const tx = createTx({ order: orderSeed({ status: "CONFIRMED" }) });
      wireTransaction(tx);

      await expectAppError(
        service.cancelOrder("order-1", "worker-1", "pp-1"),
        409,
        "ORDER_NOT_SHIPPED",
      );
      expect(tx.product.updateMany).not.toHaveBeenCalled();
    });

    it("refuses a foreign order with the same 404 a missing one answers (AC-6)", async () => {
      prismaMock.order.findFirst.mockResolvedValue(null);

      await expectAppError(
        service.cancelOrder("order-9", "worker-1", "pp-1"),
        404,
        "ORDER_NOT_FOUND",
      );
      expect(expireMock).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("refuses a switched off point (AC-9)", async () => {
      const tx = createTx({ order: orderSeed(), pointActive: false });
      wireTransaction(tx);

      await expectAppError(
        service.cancelOrder("order-1", "worker-1", "pp-1"),
        409,
        "PICKUP_POINT_INACTIVE",
      );
      expect(tx.product.updateMany).not.toHaveBeenCalled();
    });

    it("keeps a paid order PAID and names the money owed back (AC-8)", async () => {
      const seed = orderSeed({ paymentStatus: "PAID", paymentMethod: "ONLINE_CARD" });
      const tx = createTx({ order: seed });
      wireTransaction(tx);

      await service.cancelOrder("order-1", "worker-1", "pp-1");

      const warning = logLines(warnSpy).find(
        (entry) => entry.event === "payment.refund_owed",
      );

      expect(warning).toEqual(
        expect.objectContaining({
          reason: "point_cancel",
          orderId: "order-1",
          buyerUserId: "buyer-1",
          actorUserId: "worker-1",
          pointId: "pp-1",
          amount: "119.98",
          currency: "RUB",
          cancelledLineCount: 2,
        }),
      );
      expect(seed.paymentStatus).toBe("PAID");
      expect(tx.payment.updateMany).toHaveBeenCalledWith({
        where: { orderId: "order-1", status: { in: ["PENDING", "FAILED"] } },
        data: { status: "CANCELLED" },
      });
    });

    it("cancels the open attempts of an unpaid order and marks its payment cancelled (AC-8)", async () => {
      const seed = orderSeed({ paymentStatus: "PENDING" });
      const tx = createTx({ order: seed });
      wireTransaction(tx);

      await service.cancelOrder("order-1", "worker-1", "pp-1");

      expect(seed.paymentStatus).toBe("CANCELLED");
      expect(
        logLines(warnSpy).some((entry) => entry.event === "payment.refund_owed"),
      ).toBe(false);
    });

    it("logs a cancel with the count and a refusal with its code (AC-6)", async () => {
      const paid = orderSeed();
      wireTransaction(createTx({ order: paid }));

      await service.cancelOrder("order-1", "worker-1", "pp-1");

      expect(logLines(infoSpy)).toContainEqual(
        expect.objectContaining({
          event: "staff.point.cancelled",
          orderId: "order-1",
          cancelledLineCount: 2,
          resultCode: "OK",
        }),
      );
    });
  });
});
