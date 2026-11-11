import { Prisma } from "../../../generated/prisma/client";
import {
  lockOrder,
  ORDER_TRANSACTION_OPTIONS,
  recomputeOrderStatus,
  returnOrderStock,
} from "./order-status.helpers";

const createTransaction = () => {
  const mocks = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    orderItem: { findMany: jest.fn() },
    order: { update: jest.fn() },
    product: { updateMany: jest.fn() },
  };

  return {
    client: mocks as unknown as Prisma.TransactionClient,
    mocks,
  };
};

describe("order status helpers", () => {
  it("uses the earliest active line status and leaves payment unchanged (AC-8, AC-12)", async () => {
    const { client, mocks } = createTransaction();
    mocks.orderItem.findMany.mockResolvedValue([
      { status: "DELIVERED" },
      { status: "CANCELLED" },
      { status: "SHIPPED" },
      { status: "CONFIRMED" },
      { status: "OUT_OF_STOCK" },
    ]);

    await recomputeOrderStatus(client, "order-1");

    expect(mocks.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "CONFIRMED" },
    });
  });

  it("cancels the order when no active lines remain (AC-8)", async () => {
    const { client, mocks } = createTransaction();
    mocks.orderItem.findMany.mockResolvedValue([
      { status: "CANCELLED" },
      { status: "OUT_OF_STOCK" },
    ]);

    await recomputeOrderStatus(client, "order-1", "CANCELLED");

    expect(mocks.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "CANCELED", paymentStatus: "CANCELLED" },
    });
  });

  it("возвращает посчитанный статус заказа (AC-11)", async () => {
    const { client, mocks } = createTransaction();
    mocks.orderItem.findMany.mockResolvedValue([
      { status: "DELIVERED" },
      { status: "DELIVERED" },
    ]);

    const status = await recomputeOrderStatus(client, "order-1");

    expect(status).toBe("DELIVERED");
  });

  it("returns stock with an atomic increment and clears the stock flag (AC-9)", async () => {
    const { client, mocks } = createTransaction();

    await returnOrderStock(client, [
      { productId: "product-1", quantity: 2 },
      { productId: "product-2", quantity: 5 },
    ]);

    expect(mocks.product.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "product-1" },
      data: { quantity: { increment: 2 }, isOutOfStock: false },
    });
    expect(mocks.product.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "product-2" },
      data: { quantity: { increment: 5 }, isOutOfStock: false },
    });
  });

  it("locks the parent order before status reads (AC-11)", async () => {
    const { client, mocks } = createTransaction();

    await lockOrder(client, "order-1");

    const [query, orderId] = mocks.$queryRaw.mock.calls[0];
    expect(Array.from(query as TemplateStringsArray).join("")).toContain(
      'SELECT id FROM "Order" WHERE id = ',
    );
    expect(Array.from(query as TemplateStringsArray).join("")).toContain(
      " FOR UPDATE",
    );
    expect(orderId).toBe("order-1");
  });

  it("uses the specified transaction limits and isolation level (AC-11)", () => {
    expect(ORDER_TRANSACTION_OPTIONS).toEqual({
      maxWait: 5000,
      timeout: 10000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  });
});
