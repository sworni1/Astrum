jest.mock("../../../../lib/prisma", () => ({
  prisma: { $transaction: jest.fn() },
}));

import type { OrderItemStatus } from "../../../../generated/prisma/enums";
import { prisma } from "../../../../lib/prisma";
import { SellerOrderService } from "../seller-order.service";

const prismaMock = prisma as unknown as { $transaction: jest.Mock };

const LINE = {
  id: "line-1",
  orderId: "order-1",
  productId: "product-1",
  name: "Drill",
  previewImage: "http://cdn/drill.png",
  quantity: 1,
  price: 19.99,
  currency: "RUB",
  status: "SHIPPED" as OrderItemStatus,
};

const createTx = (options: { currentStatus: OrderItemStatus }) => ({
  $queryRaw: jest.fn().mockResolvedValue([]),
  orderItem: {
    findUnique: jest.fn().mockResolvedValue({ orderId: "order-1" }),
    findFirst: jest
      .fn()
      .mockResolvedValue({ ...LINE, status: options.currentStatus }),
    update: jest.fn().mockImplementation(async ({ data }) => ({
      ...LINE,
      ...data,
    })),
    findMany: jest.fn().mockResolvedValue([{ status: "DELIVERED" }]),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  order: {
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
});

type Tx = ReturnType<typeof createTx>;

const useTx = (tx: Tx): void => {
  prismaMock.$transaction.mockImplementation((fn: (client: Tx) => unknown) =>
    fn(tx),
  );
};

describe("SellerOrderService.updateSellerOrderItemStatus, delivery dates", () => {
  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("ставит receiptDate и handedOverAt серверным временем на DELIVERED (AC-12)", async () => {
    const tx = createTx({ currentStatus: "SHIPPED" });
    useTx(tx);

    const line = await new SellerOrderService().updateSellerOrderItemStatus(
      "line-1",
      "seller-1",
      "DELIVERED",
    );

    const [update] = tx.orderItem.update.mock.calls[0];
    expect(update.data.status).toBe("DELIVERED");
    expect(update.data.receiptDate).toBeInstanceOf(Date);
    expect(line.status).toBe("DELIVERED");

    expect(tx.order.updateMany).toHaveBeenCalledTimes(1);
    const [handover] = tx.order.updateMany.mock.calls[0];
    expect(handover.where).toEqual({ id: "order-1", handedOverAt: null });
    expect(handover.data.handedOverAt).toBeInstanceOf(Date);
  });

  it("не переписывает даты на повторе DELIVERED (AC-12)", async () => {
    const tx = createTx({ currentStatus: "DELIVERED" });
    useTx(tx);

    await new SellerOrderService().updateSellerOrderItemStatus(
      "line-1",
      "seller-1",
      "DELIVERED",
    );

    expect(tx.orderItem.update).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it("не трогает handedOverAt, пока заказ не закрыт (AC-12)", async () => {
    const tx = createTx({ currentStatus: "SHIPPED" });
    tx.orderItem.findMany.mockResolvedValue([{ status: "SHIPPED" }, { status: "DELIVERED" }]);
    useTx(tx);

    await new SellerOrderService().updateSellerOrderItemStatus(
      "line-1",
      "seller-1",
      "DELIVERED",
    );

    expect(tx.orderItem.update).toHaveBeenCalledTimes(1);
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });
});
