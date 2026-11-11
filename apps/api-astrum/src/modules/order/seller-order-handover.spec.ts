jest.mock("../../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    business: { findUnique: jest.fn() },
  },
}));

import type { OrderItemStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import { SellerOrderService } from "./seller-order.service";

const prismaMock = prisma as unknown as {
  $transaction: jest.Mock;
  business: { findUnique: jest.Mock };
};

const lineOf = (id: string, status: OrderItemStatus) => ({
  id,
  orderId: "order-1",
  productId: "product-1",
  name: "Drill",
  previewImage: "http://cdn/drill.png",
  quantity: 1,
  price: 19.99,
  currency: "RUB",
  status,
});

type OrderRow = {
  id: string;
  createdAt: Date;
  pickupPointId: string | null;
  pickupPointName: string | null;
  pickupPointAddress: string | null;
  handedOverAt: Date | null;
  shippingMethod: { isPickup: boolean };
};

const ORDER_ROW: OrderRow = {
  id: "order-1",
  createdAt: new Date("2026-12-01T10:00:00.000Z"),
  pickupPointId: "pp-1",
  pickupPointName: "Central Pickup",
  pickupPointAddress: "Tverskaya 12",
  handedOverAt: null,
  shippingMethod: { isPickup: true },
};

const createTx = (options: {
  order?: OrderRow | null;
  lines: Array<{ id: string; status: OrderItemStatus }>;
}) => {
  const state = () => options.lines.map((line) => ({ ...line }));

  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    order: {
      findFirst: jest.fn().mockImplementation(async () => {
        if (options.order === undefined || options.order === null) {
          return null;
        }

        return { ...options.order, OrderItem: state() };
      }),
      findFirstOrThrow: jest
        .fn()
        .mockImplementation(async () => ({
          ...(options.order ?? ORDER_ROW),
          OrderItem: state(),
        })),
      updateMany: jest.fn().mockImplementation(async ({ data }) => {
        if (data.handedOverAt !== undefined) {
          if (options.order) {
            options.order.handedOverAt = data.handedOverAt;
          }
        }

        return { count: 1 };
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    orderItem: {
      updateMany: jest
        .fn()
        .mockImplementation(async ({ where, data }: {
          where: { id: { in: string[] } };
          data: { status: OrderItemStatus };
        }) => {
          const ids = new Set(where.id.in);

          for (const line of options.lines) {
            if (ids.has(line.id)) {
              line.status = data.status;
            }
          }

          return { count: ids.size };
        }),
      findMany: jest
        .fn()
        .mockImplementation(async () => options.lines.map((line) => ({
          status: line.status,
        }))),
    },
  };

  return tx;
};

type Tx = ReturnType<typeof createTx>;

const useTx = (tx: Tx): void => {
  prismaMock.$transaction.mockImplementation((fn: (client: Tx) => unknown) =>
    fn(tx),
  );
};

const codeOf = async (promise: Promise<unknown>): Promise<string | undefined> => {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error instanceof AppError ? `${error.status} ${error.code}` : "NOT_AN_APP_ERROR";
  }
};

describe("SellerOrderService.handOverOrder", () => {
  beforeEach(() => {
    prismaMock.business.findUnique.mockResolvedValue({ id: "business-1" });
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("отвечает 404 на чужой заказ, не раскрывая владельца (AC-11)", async () => {
    const tx = createTx({ order: null, lines: [] });
    useTx(tx);

    const code = await codeOf(
      new SellerOrderService().handOverOrder("order-1", "seller-1"),
    );

    expect(code).toBe("404 ORDER_NOT_FOUND");
    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
  });

  it("отказывает заказу без точки (AC-11)", async () => {
    const tx = createTx({
      order: { ...ORDER_ROW, pickupPointId: null },
      lines: [{ id: "line-1", status: "CONFIRMED" }],
    });
    useTx(tx);

    const code = await codeOf(
      new SellerOrderService().handOverOrder("order-1", "seller-1"),
    );

    expect(code).toBe("409 HANDOVER_REQUIRES_PICKUP");
    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
  });

  it("выдаёт готовые строки, оставляет PENDING и не ставит дату заказа (AC-11)", async () => {
    const tx = createTx({
      order: ORDER_ROW,
      lines: [
        { id: "line-1", status: "CONFIRMED" },
        { id: "line-2", status: "SHIPPED" },
        { id: "line-3", status: "PENDING" },
      ],
    });
    useTx(tx);

    const group = await new SellerOrderService().handOverOrder(
      "order-1",
      "seller-1",
    );

    expect(tx.orderItem.updateMany).toHaveBeenCalledTimes(1);
    const [update] = tx.orderItem.updateMany.mock.calls[0];
    expect(update.where.id.in).toEqual(["line-1", "line-2"]);
    expect(update.data.status).toBe("DELIVERED");
    expect(update.data.receiptDate).toBeInstanceOf(Date);
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(group.orderItems.map((line) => line.status)).toEqual([
      "DELIVERED",
      "DELIVERED",
      "PENDING",
    ]);
    expect(group.handedOverAt).toBeNull();
  });

  it("пишет дату выдачи один раз в той же транзакции, что закрыла заказ (AC-11)", async () => {
    const order = { ...ORDER_ROW };
    const tx = createTx({
      order,
      lines: [
        { id: "line-1", status: "CONFIRMED" },
        { id: "line-2", status: "SHIPPED" },
      ],
    });
    useTx(tx);

    const group = await new SellerOrderService().handOverOrder(
      "order-1",
      "seller-1",
    );

    expect(tx.order.updateMany).toHaveBeenCalledTimes(1);
    const [write] = tx.order.updateMany.mock.calls[0];
    expect(write.where).toEqual({ id: "order-1", handedOverAt: null });
    expect(write.data.handedOverAt).toBeInstanceOf(Date);
    expect(group.handedOverAt).toBeInstanceOf(Date);
    expect(group.orderItems.every((line) => line.status === "DELIVERED")).toBe(
      true,
    );
  });

  it("отвечает 200 и ничего не пишет на повторный вызов (AC-11)", async () => {
    const tx = createTx({
      order: ORDER_ROW,
      lines: [
        { id: "line-1", status: "DELIVERED" },
        { id: "line-2", status: "DELIVERED" },
      ],
    });
    useTx(tx);

    const group = await new SellerOrderService().handOverOrder(
      "order-1",
      "seller-1",
    );

    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(group.id).toBe("order-1");
  });

  it("отказывает заказу, где готовых строк нет (AC-11)", async () => {
    const tx = createTx({
      order: ORDER_ROW,
      lines: [{ id: "line-1", status: "PENDING" }],
    });
    useTx(tx);

    const code = await codeOf(
      new SellerOrderService().handOverOrder("order-1", "seller-1"),
    );

    expect(code).toBe("409 NOTHING_TO_HAND_OVER");
    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
  });

  it("отказывает продавцу без бизнеса (AC-11)", async () => {
    prismaMock.business.findUnique.mockResolvedValue(null);
    const tx = createTx({ order: ORDER_ROW, lines: [] });
    useTx(tx);

    const code = await codeOf(
      new SellerOrderService().handOverOrder("order-1", "seller-1"),
    );

    expect(code).toBe("403 SELLER_NOT_ASSIGNED");
  });
});
