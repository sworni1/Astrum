jest.mock("../../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    product: { findMany: jest.fn() },
    order: { findFirst: jest.fn(), findMany: jest.fn() },
  },
}));

import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import type { CreateOrderDto } from "./dto/create-order.dto";
import { idempotencyOf } from "./idempotency";
import { OrderService } from "./order.service";

const prismaMock = prisma as unknown as {
  $transaction: jest.Mock;
  product: { findMany: jest.Mock };
  order: { findFirst: jest.Mock; findMany: jest.Mock };
};

const COURIER = {
  id: "sm-courier",
  name: "Express Delivery",
  price: new Prisma.Decimal("799.00"),
  currency: "RUB",
  isActive: true,
  isPickup: false,
};

const PICKUP = {
  id: "sm-pickup",
  name: "Pickup at the shop",
  price: new Prisma.Decimal("0.00"),
  currency: "RUB",
  isActive: true,
  isPickup: true,
};

const ACTIVE_POINT = {
  id: "pp-1",
  name: "Central Pickup",
  address: "Tverskaya 12, Moscow",
  isActive: true,
};

const INACTIVE_POINT = { ...ACTIVE_POINT, id: "pp-off", isActive: false };

const makeDto = (overrides: Partial<CreateOrderDto> = {}): CreateOrderDto =>
  ({
    deliveryAddress: "Lenina 1",
    deliveryDate: new Date("2026-12-01T12:00:00.000Z") as never,
    shippingMethodId: "sm-pickup",
    paymentMethod: "CASH",
    paymentDetails: "Cash on delivery",
    orderItems: [{ productId: "p-1", quantity: 2 }],
    ...overrides,
  }) as CreateOrderDto;

const createTx = (options: {
  method: typeof COURIER | typeof PICKUP;
  point?: typeof ACTIVE_POINT | null;
}) => ({
  shippingMethod: { findUnique: jest.fn().mockResolvedValue(options.method) },
  pickupPoint: {
    findUnique: jest.fn().mockResolvedValue(options.point ?? null),
  },
  product: {
    findMany: jest.fn().mockResolvedValue([
      {
        id: "p-1",
        businessId: "business-1",
        name: "Drill",
        previewImage: "http://cdn/drill.png",
        price: 19.99,
        currency: "RUB",
        quantity: 10,
        isOutOfStock: false,
        isDeleted: false,
        visibility: "Public",
        status: "Published",
      },
    ]),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  cartItem: {
    findMany: jest.fn().mockResolvedValue([{ productId: "p-1", quantity: 5 }]),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  order: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(({ data }) => ({
      id: "order-1",
      userId: data.userId,
      totalPrice: data.totalPrice,
      currency: data.currency,
      paymentMethod: data.paymentMethod,
      paymentStatus: "PENDING",
      paymentDetails: data.paymentDetails,
      status: "PENDING",
      createdAt: new Date("2026-12-01T10:00:00.000Z"),
      updatedAt: new Date("2026-12-01T10:00:00.000Z"),
      deliveryAddress: data.deliveryAddress,
      deliveryDate: data.deliveryDate,
      shippingMethodId: data.shippingMethodId,
      shippingMethodName: data.shippingMethodName,
      deliveryPrice: data.deliveryPrice,
      grandTotal: data.grandTotal,
      pickupPointId: data.pickupPointId,
      pickupPointName: data.pickupPointName,
      pickupPointAddress: data.pickupPointAddress,
      handedOverAt: null,
      OrderItem: data.OrderItem.create.map(
        (line: Record<string, unknown>, index: number) => ({
          id: `line-${index}`,
          orderId: "order-1",
          receiptDate: null,
          ...line,
        }),
      ),
    })),
  },
});

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
    return error instanceof AppError ? error.code : "NOT_AN_APP_ERROR";
  }
};

describe("OrderService.createOrder pickup rules", () => {
  beforeEach(() => {
    prismaMock.product.findMany.mockResolvedValue([]);
    prismaMock.order.findFirst.mockResolvedValue(null);
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("отказывает точке на курьерском методе и ничего не пишет (AC-7)", async () => {
    const tx = createTx({ method: COURIER });
    useTx(tx);

    const code = await codeOf(
      new OrderService().createOrder(
        "user-1",
        makeDto({ shippingMethodId: COURIER.id, pickupPointId: "pp-1" }),
      ),
    );

    expect(code).toBe("PICKUP_POINT_NOT_ALLOWED");
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it("требует точку на методе самовывоза (AC-7)", async () => {
    const tx = createTx({ method: PICKUP });
    useTx(tx);

    const code = await codeOf(
      new OrderService().createOrder("user-1", makeDto()),
    );

    expect(code).toBe("PICKUP_POINT_REQUIRED");
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("отказывает неизвестной точке (AC-7)", async () => {
    const tx = createTx({ method: PICKUP, point: null });
    useTx(tx);

    const code = await codeOf(
      new OrderService().createOrder(
        "user-1",
        makeDto({ pickupPointId: "pp-missing" }),
      ),
    );

    expect(code).toBe("UNKNOWN_PICKUP_POINT");
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("отказывает выключенной точке (AC-7)", async () => {
    const tx = createTx({ method: PICKUP, point: INACTIVE_POINT });
    useTx(tx);

    const code = await codeOf(
      new OrderService().createOrder(
        "user-1",
        makeDto({ pickupPointId: INACTIVE_POINT.id }),
      ),
    );

    expect(code).toBe("PICKUP_POINT_INACTIVE");
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("проверяет метод раньше точки (AC-7)", async () => {
    const tx = createTx({
      method: { ...COURIER, isActive: false },
      point: ACTIVE_POINT,
    });
    useTx(tx);

    const code = await codeOf(
      new OrderService().createOrder(
        "user-1",
        makeDto({ shippingMethodId: COURIER.id, pickupPointId: "pp-1" }),
      ),
    );

    expect(code).toBe("SHIPPING_METHOD_INACTIVE");
  });

  it("хранит снимок точки, нулевую доставку и пустой адрес (AC-7)", async () => {
    const tx = createTx({ method: PICKUP, point: ACTIVE_POINT });
    useTx(tx);

    const { order } = await new OrderService().createOrder(
      "user-1",
      makeDto({ pickupPointId: ACTIVE_POINT.id, deliveryAddress: "Lenina 1" }),
    );

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pickupPointId: ACTIVE_POINT.id,
          pickupPointName: ACTIVE_POINT.name,
          pickupPointAddress: ACTIVE_POINT.address,
          deliveryAddress: null,
          shippingMethodName: PICKUP.name,
          deliveryPrice: new Prisma.Decimal(0),
        }),
      }),
    );
    expect(order.deliveryPrice.toFixed(2)).toBe("0.00");
    expect(order.grandTotal.toFixed(2)).toBe(order.totalPrice.toFixed(2));
  });

  it("не пишет поля точки у курьерского заказа (AC-7)", async () => {
    const tx = createTx({ method: COURIER });
    useTx(tx);

    await new OrderService().createOrder(
      "user-1",
      makeDto({ shippingMethodId: COURIER.id }),
    );

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pickupPointId: null,
          pickupPointName: null,
          pickupPointAddress: null,
          deliveryAddress: "Lenina 1",
        }),
      }),
    );
  });

  it("отвечает повтором ключа с другой точкой как переиспользованием (AC-7)", async () => {
    const key = "pickup-key-1";
    const firstDto = makeDto({ pickupPointId: ACTIVE_POINT.id });
    const storedHash = idempotencyOf(key, firstDto, [
      { productId: "p-1", quantity: 2 },
    ]).hash;

    prismaMock.order.findFirst.mockResolvedValue({
      id: "order-1",
      idempotencyKey: key,
      idempotencyHash: storedHash,
      pickupPointId: ACTIVE_POINT.id,
      orderItems: [],
    });

    const code = await codeOf(
      new OrderService().createOrder(
        "user-1",
        makeDto({ pickupPointId: "pp-other" }),
        key,
      ),
    );

    expect(code).toBe("IDEMPOTENCY_KEY_REUSED");
  });
});
