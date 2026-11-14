jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    order: { findMany: jest.fn() },
  },
}));

jest.mock("../order-status.helpers", () => ({
  recomputeOrderStatus: jest.fn(),
}));

import { prisma } from "../../../../lib/prisma";
import { ORDER_SHIPPING_DELAY_MS } from "../constants/order.constants";
import { runOrderShipping } from "../order-shipping";
import { recomputeOrderStatus } from "../order-status.helpers";

const prismaMock = prisma as unknown as {
  $transaction: jest.Mock;
  order: { findMany: jest.Mock };
};
const recomputeMock = recomputeOrderStatus as jest.Mock;

const tx = () => ({
  orderItem: { updateMany: jest.fn() },
  order: { update: jest.fn(), findMany: jest.fn() },
});

type FakeTx = ReturnType<typeof tx>;

const wire = (orders: unknown[], shippedLines = 2): FakeTx => {
  const client = tx();

  client.orderItem.updateMany.mockResolvedValue({ count: shippedLines });
  prismaMock.order.findMany.mockResolvedValue(orders);
  prismaMock.$transaction.mockImplementation(
    (work: (inner: FakeTx) => unknown) => work(client),
  );

  return client;
};

const NOW = 1_700_000_000_000;

const ago = (ms: number): Date => new Date(NOW - ms);

const order = (overrides: Record<string, unknown> = {}) => ({
  id: "order-1",
  status: "CONFIRMED",
  createdAt: ago(ORDER_SHIPPING_DELAY_MS + 30_000),
  payments: [] as Array<{ paidAt: Date | null }>,
  ...overrides,
});

const logged = (spy: jest.SpyInstance): Array<Record<string, unknown>> =>
  spy.mock.calls.map((call) => {
    try {
      return JSON.parse(String(call[0])) as Record<string, unknown>;
    } catch {
      return { raw: call[0] } as Record<string, unknown>;
    }
  });

describe("runOrderShipping", () => {
  let info: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    info = jest.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    info.mockRestore();
  });

  it("отправляет заказ, принятый больше минуты назад (AC-2)", async () => {
    const client = wire([order()]);

    await runOrderShipping(new Date(NOW));

    expect(client.orderItem.updateMany).toHaveBeenCalledWith({
      where: { orderId: "order-1", status: "CONFIRMED" },
      data: { status: "SHIPPED" },
    });
    expect(recomputeMock).toHaveBeenCalledWith(client, "order-1");
    expect(logged(info)).toContainEqual(
      expect.objectContaining({
        event: "order.lines_shipped",
        orderId: "order-1",
        lineCount: 2,
      }),
    );
  });

  it("считает время от оплаты, а не от создания заказа (AC-2)", async () => {
    const client = wire([
      order({ createdAt: ago(600_000), payments: [{ paidAt: ago(20_000) }] }),
    ]);

    await runOrderShipping(new Date(NOW));

    expect(client.orderItem.updateMany).not.toHaveBeenCalled();
    expect(recomputeMock).not.toHaveBeenCalled();
  });

  it("отправляет заказ, оплаченный больше минуты назад (AC-2)", async () => {
    const client = wire([
      order({
        createdAt: ago(600_000),
        payments: [{ paidAt: ago(ORDER_SHIPPING_DELAY_MS + 5_000) }],
      }),
    ]);

    await runOrderShipping(new Date(NOW));

    expect(client.orderItem.updateMany).toHaveBeenCalledTimes(1);
  });

  it("ищет только подтверждённые заказы с подтверждёнными строками (AC-2)", async () => {
    wire([]);

    await runOrderShipping(new Date(NOW));

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "CONFIRMED",
          createdAt: { lte: new Date(NOW - ORDER_SHIPPING_DELAY_MS) },
          OrderItem: { some: { status: "CONFIRMED" } },
        }),
      }),
    );
  });

  it("не пишет ничего, когда подтверждённых строк уже нет (AC-2)", async () => {
    const client = wire([order()], 0);

    await runOrderShipping(new Date(NOW));

    expect(client.orderItem.updateMany).toHaveBeenCalledTimes(1);
    expect(recomputeMock).not.toHaveBeenCalled();
    expect(logged(info).map((entry) => entry.event)).not.toContain(
      "order.lines_shipped",
    );
  });
});
