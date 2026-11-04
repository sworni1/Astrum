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
import { mergeOrderLines, OrderService } from "./order.service";

type ProductRow = {
  id: string;
  name: string;
  previewImage: string;
  price: number;
  currency: "RUB" | "USD";
  quantity: number;
  isOutOfStock: boolean;
  isDeleted: boolean;
  visibility: "Public" | "Private" | "Archived" | "Draft";
  status: "Draft" | "Published" | "Discontinued";
};

const prismaMock = prisma as unknown as {
  $transaction: jest.Mock;
  product: { findMany: jest.Mock };
  order: { findFirst: jest.Mock; findMany: jest.Mock };
};

const makeProduct = (overrides: Partial<ProductRow> = {}): ProductRow => ({
  id: "p-1",
  name: "Drill",
  previewImage: "http://cdn/drill.png",
  price: 19.99,
  currency: "RUB",
  quantity: 10,
  isOutOfStock: false,
  isDeleted: false,
  visibility: "Public",
  status: "Published",
  ...overrides,
});

const makeDto = (overrides: Partial<CreateOrderDto> = {}): CreateOrderDto =>
  ({
    deliveryAddress: "Lenina 1",
    deliveryDate: new Date("2026-11-10T12:00:00.000Z") as never,
    shippingMethodId: "ship-1",
    paymentMethod: "CASH",
    paymentDetails: "Cash on delivery",
    orderItems: [{ productId: "p-1", quantity: 3 }],
    ...overrides,
  }) as CreateOrderDto;

const createTx = () => ({
  shippingMethod: {
    findUnique: jest
      .fn()
      .mockResolvedValue({ id: "ship-1", name: "Standard", price: 5.99 }),
  },
  product: {
    findMany: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  cartItem: {
    findMany: jest.fn().mockResolvedValue([
      { productId: "p-1", quantity: 999 },
      { productId: "p-2", quantity: 999 },
    ]),
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
      createdAt: new Date("2026-11-04T10:00:00.000Z"),
      updatedAt: new Date("2026-11-04T10:00:00.000Z"),
      deliveryAddress: data.deliveryAddress,
      deliveryDate: data.deliveryDate,
      shippingMethodId: data.shippingMethodId,
      shippingMethod: { id: "ship-1", name: "Standard", price: 5.99 },
      OrderItem: data.OrderItem.create.map(
        (line: Record<string, unknown>, index: number) => ({
          id: `line-${index}`,
          orderId: "order-1",
          receiptDate: null,
          review: null,
          ...line,
        }),
      ),
    })),
  },
});

type Tx = ReturnType<typeof createTx>;

const decrements = (tx: Tx) =>
  tx.product.updateMany.mock.calls
    .map(([args]) => args)
    .filter((args) => args.data.quantity !== undefined);

const expectAppError = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await promise.catch((error: AppError) => {
    expect(error.code).toBe(code);
  });
};

describe("OrderService.createOrder", () => {
  let tx: Tx;

  beforeEach(() => {
    tx = createTx();
    prismaMock.$transaction.mockImplementation((fn: (client: Tx) => unknown) =>
      fn(tx),
    );
    prismaMock.product.findMany.mockResolvedValue([]);
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("берёт цену, имя и картинку из товара и пишет заказ в одной транзакции (AC-1, AC-2, AC-3)", async () => {
    tx.product.findMany.mockResolvedValue([
      makeProduct({ id: "p-1", price: 19.99, quantity: 10 }),
      makeProduct({
        id: "p-2",
        name: "Saw",
        previewImage: "http://cdn/saw.png",
        price: 5.49,
        quantity: 4,
      }),
    ]);
    tx.cartItem.findMany.mockResolvedValue([
      { productId: "p-1", quantity: 3 },
      { productId: "p-2", quantity: 2 },
    ]);

    const { order } = await new OrderService().createOrder(
      "user-1",
      makeDto({
        orderItems: [
          { productId: "p-1", quantity: 3 },
          { productId: "p-2", quantity: 2 },
        ],
      }),
    );

    const createArgs = tx.order.create.mock.calls[0][0];
    expect(createArgs.data.currency).toBe("RUB");
    expect(createArgs.data.totalPrice.toFixed(2)).toBe("70.95");
    expect(createArgs.data.OrderItem.create).toEqual([
      expect.objectContaining({
        productId: "p-1",
        name: "Drill",
        previewImage: "http://cdn/drill.png",
        quantity: 3,
        currency: "RUB",
        userId: "user-1",
      }),
      expect.objectContaining({
        productId: "p-2",
        quantity: 2,
        currency: "RUB",
      }),
    ]);
    expect(createArgs.data.OrderItem.create[0].price.toFixed(2)).toBe("19.99");

    expect(decrements(tx).map((args) => args.where.id)).toEqual(["p-1", "p-2"]);
    expect(decrements(tx)[0].data.quantity).toEqual({ decrement: 3 });
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: "p-1", quantity: 0 },
      data: { isOutOfStock: true },
    });

    expect(order.orderItems).toHaveLength(2);
    expect(order.shippingMethod).toEqual({ name: "Standard", price: 5.99 });
  });

  it("округляет цену товара до двух знаков (AC-1)", async () => {
    tx.product.findMany.mockResolvedValue([
      makeProduct({ price: 19.999, quantity: 10 }),
    ]);

    await new OrderService().createOrder("user-1", makeDto());

    const line = tx.order.create.mock.calls[0][0].data.OrderItem.create[0];
    expect(line.price.toFixed(2)).toBe("20.00");
    expect(tx.order.create.mock.calls[0][0].data.totalPrice.toFixed(2)).toBe(
      "60.00",
    );
  });

  it("сливает повторные строки одного товара перед проверкой остатка (AC-7)", async () => {
    tx.product.findMany.mockResolvedValue([makeProduct({ quantity: 10 })]);

    await new OrderService().createOrder(
      "user-1",
      makeDto({
        orderItems: [
          { productId: "p-1", quantity: 2 },
          { productId: "p-1", quantity: 3 },
        ],
      }),
    );

    const line = tx.order.create.mock.calls[0][0].data.OrderItem.create[0];
    expect(line.quantity).toBe(5);
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: "p-1", quantity: { gte: 5 }, isOutOfStock: false },
      data: { quantity: { decrement: 5 } },
    });
  });

  it("отказывает всей строке, если склад меньше запрошенного (AC-4)", async () => {
    tx.product.findMany.mockResolvedValue([makeProduct({ quantity: 2 })]);

    await expectAppError(
      new OrderService().createOrder("user-1", makeDto()),
      "OUT_OF_STOCK",
    );

    expect(tx.order.create).not.toHaveBeenCalled();
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it("отказывает товару, который не опубликован или скрыт (AC-5)", async () => {
    tx.product.findMany.mockResolvedValue([
      makeProduct({ visibility: "Draft", quantity: 10 }),
    ]);

    const error = await new OrderService()
      .createOrder("user-1", makeDto())
      .catch((caught: AppError) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).status).toBe(409);
    expect((error as AppError).code).toBe("OUT_OF_STOCK");
    expect((error as AppError).details).toEqual({
      items: [{ productId: "p-1", requested: 3, available: 0 }],
    });
  });

  it("отказывает строке, которой нет в корзине (AC-6)", async () => {
    tx.product.findMany.mockResolvedValue([makeProduct({ quantity: 10 })]);
    tx.cartItem.findMany.mockResolvedValue([{ productId: "p-1", quantity: 2 }]);

    const error = await new OrderService()
      .createOrder("user-1", makeDto())
      .catch((caught: AppError) => caught);

    expect((error as AppError).code).toBe("CART_MISMATCH");
    expect(error).toMatchObject({ status: 409 });
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("отказывает неизвестному способу доставки до списания остатка (AC-10)", async () => {
    tx.shippingMethod.findUnique.mockResolvedValue(null);
    tx.product.findMany.mockResolvedValue([makeProduct({ quantity: 10 })]);

    await expectAppError(
      new OrderService().createOrder("user-1", makeDto()),
      "UNKNOWN_SHIPPING_METHOD",
    );

    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("отказывает заказу из товаров разных валют (AC-2)", async () => {
    tx.product.findMany.mockResolvedValue([
      makeProduct({ id: "p-1", quantity: 10, currency: "RUB" }),
      makeProduct({ id: "p-2", quantity: 10, currency: "USD" }),
    ]);

    const error = await new OrderService()
      .createOrder(
        "user-1",
        makeDto({
          orderItems: [
            { productId: "p-1", quantity: 1 },
            { productId: "p-2", quantity: 1 },
          ],
        }),
      )
      .catch((caught: AppError) => caught);

    expect((error as AppError).code).toBe("MIXED_CURRENCY");
    expect((error as AppError).details).toEqual({ productIds: ["p-2"] });
  });

  it("перечитывает остаток после отката, когда списание не прошло (AC-4)", async () => {
    tx.product.findMany.mockResolvedValue([makeProduct({ quantity: 5 })]);
    tx.product.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.product.findMany.mockResolvedValue([
      makeProduct({ quantity: 4 }),
    ]);

    const error = await new OrderService()
      .createOrder(
        "user-1",
        makeDto({ orderItems: [{ productId: "p-1", quantity: 5 }] }),
      )
      .catch((caught: AppError) => caught);

    expect((error as AppError).code).toBe("OUT_OF_STOCK");
    expect((error as AppError).details).toEqual({
      items: [{ productId: "p-1", requested: 5, available: 4 }],
    });
    expect((error as AppError).message).toContain("Drill");
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("помечает товар распроданным, когда остаток дошёл до нуля (AC-3)", async () => {
    tx.product.findMany.mockResolvedValue([makeProduct({ quantity: 3 })]);

    await new OrderService().createOrder("user-1", makeDto());

    expect(tx.product.updateMany).toHaveBeenLastCalledWith({
      where: { id: "p-1", quantity: 0 },
      data: { isOutOfStock: true },
    });
  });
});

describe("mergeOrderLines", () => {
  it("сливает повторные товары в одну строку", () => {
    expect(
      mergeOrderLines([
        { productId: "p-1", quantity: 2 },
        { productId: "p-1", quantity: 3 },
      ]),
    ).toEqual([{ productId: "p-1", quantity: 5 }]);
  });

  it("отказывает, если после слияния строка больше 999 (AC-7)", () => {
    expect(() =>
      mergeOrderLines([
        { productId: "p-1", quantity: 600 },
        { productId: "p-1", quantity: 600 },
      ]),
    ).toThrow(AppError);
  });

  it("отказывает пустому списку строк (AC-7)", () => {
    expect(() => mergeOrderLines([])).toThrow(AppError);
  });
});

describe("OrderService.getOrderById", () => {
  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("отдаёт 404 как AppError, когда заказ чужой или его нет (AC-8)", async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);

    const error = await new OrderService()
      .getOrderById("order-9", "user-1")
      .catch((caught: AppError) => caught);

    expect(prismaMock.order.findFirst).toHaveBeenCalledWith({
      where: { id: "order-9", userId: "user-1" },
      include: { OrderItem: true, shippingMethod: true },
    });
    expect((error as AppError).status).toBe(404);
    expect((error as AppError).code).toBe("ORDER_NOT_FOUND");
  });

  it("возвращает строки заказа и способ доставки без служебного ключа", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: "order-1",
      userId: "user-1",
      totalPrice: new Prisma.Decimal("70.95"),
      currency: "RUB",
      shippingMethod: { id: "ship-1", name: "Standard", price: 5.99 },
      OrderItem: [{ id: "line-1", price: new Prisma.Decimal("19.99") }],
    });

    const order = await new OrderService().getOrderById("order-1", "user-1");

    expect(order.orderItems).toEqual([
      { id: "line-1", price: new Prisma.Decimal("19.99") },
    ]);
    expect(order.shippingMethod).toEqual({ name: "Standard", price: 5.99 });
    expect(order).not.toHaveProperty("OrderItem");
  });
});

const makeCancelableOrder = (overrides: Record<string, unknown> = {}) => ({
  id: "order-1",
  userId: "user-1",
  status: "PENDING",
  paymentStatus: "PENDING",
  totalPrice: new Prisma.Decimal("39.98"),
  currency: "RUB",
  shippingMethodId: "ship-1",
  shippingMethod: { id: "ship-1", name: "Standard", price: 5.99 },
  OrderItem: [
    {
      id: "line-1",
      productId: "p-1",
      quantity: 2,
      price: new Prisma.Decimal("19.99"),
      currency: "RUB",
      status: "PENDING",
    },
  ],
  ...overrides,
});

const createCancelTx = (order: Record<string, unknown> | null) => ({
  order: {
    findFirst: jest.fn().mockResolvedValue(order),
    update: jest.fn().mockResolvedValue(order),
    findFirstOrThrow: jest
      .fn()
      .mockResolvedValue({ ...(order ?? {}), status: "CANCELED" }),
  },
  orderItem: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
});

type CancelTx = ReturnType<typeof createCancelTx>;

describe("OrderService.updateOrderStatus", () => {
  let tx: CancelTx;

  const prepare = (order: Record<string, unknown> | null) => {
    tx = createCancelTx(order);
    prismaMock.$transaction.mockReset();
    prismaMock.$transaction.mockImplementation((fn: (client: CancelTx) => unknown) =>
      fn(tx),
    );
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("переводит заказ в CANCELED, строки в CANCELLED и возвращает остаток (AC-1, AC-2)", async () => {
    prepare(makeCancelableOrder());

    const order = await new OrderService().updateOrderStatus(
      "order-1",
      "user-1",
      "CANCELED",
    );

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "CANCELED", paymentStatus: "CANCELLED" },
    });
    expect(tx.orderItem.updateMany).toHaveBeenCalledWith({
      where: { orderId: "order-1" },
      data: { status: "CANCELLED" },
    });
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: "p-1" },
      data: { quantity: { increment: 2 }, isOutOfStock: false },
    });
    expect(order.status).toBe("CANCELED");
  });

  it("отказывает чужому заказу с 404 и ничего не пишет (AC-3)", async () => {
    prepare(null);

    const error = await new OrderService()
      .updateOrderStatus("order-9", "user-1", "CANCELED")
      .catch((caught: AppError) => caught);

    expect((error as AppError).status).toBe(404);
    expect((error as AppError).code).toBe("ORDER_NOT_FOUND");
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("отказывает отмене отгруженного заказа и не трогает склад (AC-4)", async () => {
    prepare(makeCancelableOrder({ status: "SHIPPED" }));

    const error = await new OrderService()
      .updateOrderStatus("order-1", "user-1", "CANCELED")
      .catch((caught: AppError) => caught);

    expect((error as AppError).status).toBe(409);
    expect((error as AppError).code).toBe("INVALID_STATUS_TRANSITION");
    expect((error as AppError).details).toEqual({
      from: "SHIPPED",
      to: "CANCELED",
    });
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it("отказывает переводу в любой статус кроме отмены (AC-4)", async () => {
    prepare(makeCancelableOrder());

    const error = await new OrderService()
      .updateOrderStatus("order-1", "user-1", "DELIVERED")
      .catch((caught: AppError) => caught);

    expect((error as AppError).status).toBe(409);
    expect((error as AppError).code).toBe("INVALID_STATUS_TRANSITION");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("не возвращает остаток повторно на уже отменённом заказе (AC-5)", async () => {
    prepare(makeCancelableOrder({ status: "CANCELED" }));

    const order = await new OrderService().updateOrderStatus(
      "order-1",
      "user-1",
      "CANCELED",
    );

    expect(order.status).toBe("CANCELED");
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });
});

describe("OrderService.createOrder with an idempotency key", () => {
  const KEY = "test-key-12345678";
  const hash = idempotencyOf(
    KEY,
    makeDto(),
    mergeOrderLines(makeDto().orderItems),
  ).hash;

  const existingOrder = (overrides: Record<string, unknown> = {}) => ({
    id: "order-existing",
    userId: "user-1",
    status: "PENDING",
    totalPrice: new Prisma.Decimal("59.97"),
    currency: "RUB",
    idempotencyKey: KEY,
    idempotencyHash: hash,
    shippingMethod: { id: "ship-1", name: "Standard", price: 5.99 },
    OrderItem: [{ id: "line-1", price: new Prisma.Decimal("19.99") }],
    ...overrides,
  });

  let tx: Tx;

  beforeEach(() => {
    tx = createTx();
    prismaMock.$transaction.mockReset();
    prismaMock.$transaction.mockImplementation((fn: (client: Tx) => unknown) =>
      fn(tx),
    );
    prismaMock.product.findMany.mockResolvedValue([makeProduct({ quantity: 10 })]);
    prismaMock.order.findFirst.mockReset();
    prismaMock.order.findFirst.mockResolvedValue(null);
    tx.product.findMany.mockResolvedValue([makeProduct({ quantity: 10 })]);
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("пишет ключ и отпечаток в тот же create (AC-1)", async () => {
    await new OrderService().createOrder("user-1", makeDto(), KEY);

    const data = tx.order.create.mock.calls[0][0].data;

    expect(data.idempotencyKey).toBe(KEY);
    expect(data.idempotencyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("пишет NULL в обе колонки, когда заголовка нет (AC-1)", async () => {
    await new OrderService().createOrder("user-1", makeDto());

    const data = tx.order.create.mock.calls[0][0].data;

    expect(data.idempotencyKey).toBeNull();
    expect(data.idempotencyHash).toBeNull();
    expect(tx.order.findFirst).not.toHaveBeenCalled();
  });

  it("отвечает повтором без записи, когда строка с тем же отпечатком есть (AC-2)", async () => {
    tx.order.findFirst.mockResolvedValue(existingOrder());

    const result = await new OrderService().createOrder("user-1", makeDto(), KEY);

    expect(result.replay).toBe(true);
    expect(result.order.id).toBe("order-existing");
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it("ищет строку по паре userId и ключ (AC-9)", async () => {
    await new OrderService().createOrder("user-1", makeDto(), KEY);

    expect(tx.order.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", idempotencyKey: KEY },
      include: { OrderItem: true, shippingMethod: true },
    });
  });

  it("отказывает с 409, когда отпечаток другой (AC-3)", async () => {
    const other = existingOrder({ idempotencyHash: "b".repeat(64) });
    tx.order.findFirst.mockResolvedValue(other);
    prismaMock.order.findFirst.mockResolvedValue(other);

    await expectAppError(
      new OrderService().createOrder("user-1", makeDto(), KEY),
      "IDEMPOTENCY_KEY_REUSED",
    );

    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("разрешает отказ в повтор по ключу (AC-6)", async () => {
    tx.product.findMany.mockResolvedValue([makeProduct({ quantity: 0 })]);
    prismaMock.order.findFirst.mockResolvedValue(existingOrder());

    const result = await new OrderService().createOrder("user-1", makeDto(), KEY);

    expect(result.replay).toBe(true);
    expect(result.order.id).toBe("order-existing");
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("перечитывает ключ трижды и оставляет исходный отказ, когда строки нет (AC-6)", async () => {
    tx.product.findMany.mockResolvedValue([makeProduct({ quantity: 0 })]);

    await expectAppError(
      new OrderService().createOrder("user-1", makeDto(), KEY),
      "OUT_OF_STOCK",
    );

    expect(prismaMock.order.findFirst).toHaveBeenCalledTimes(3);
  });

  it("отдаёт отменённый заказ как он есть на повторе (AC-7)", async () => {
    tx.order.findFirst.mockResolvedValue(existingOrder({ status: "CANCELED" }));

    const result = await new OrderService().createOrder("user-1", makeDto(), KEY);

    expect(result.replay).toBe(true);
    expect(result.order.status).toBe("CANCELED");
  });
});

describe("OrderService.createOrder cart clearing", () => {
  let tx: Tx;

  const create = () => new OrderService().createOrder("user-1", makeDto());

  beforeEach(() => {
    tx = createTx();
    prismaMock.$transaction.mockReset();
    prismaMock.$transaction.mockImplementation((fn: (client: Tx) => unknown) =>
      fn(tx),
    );
    prismaMock.product.findMany.mockResolvedValue([makeProduct({ quantity: 10 })]);
    prismaMock.order.findFirst.mockResolvedValue(null);
    tx.product.findMany.mockResolvedValue([makeProduct({ quantity: 10 })]);
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("удаляет строку корзины, которой не больше заказанного (AC-5)", async () => {
    tx.cartItem.findMany.mockResolvedValue([{ productId: "p-1", quantity: 3 }]);

    await create();

    expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        productId: "p-1",
        quantity: { lte: 3 },
      },
    });
    expect(tx.cartItem.updateMany).not.toHaveBeenCalled();
  });

  it("уменьшает строку корзины, которая больше заказанного (AC-5)", async () => {
    tx.cartItem.findMany.mockResolvedValue([{ productId: "p-1", quantity: 5 }]);
    tx.cartItem.deleteMany.mockResolvedValue({ count: 0 });
    tx.cartItem.updateMany.mockResolvedValue({ count: 1 });

    await create();

    expect(tx.cartItem.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        productId: "p-1",
        quantity: { gte: 3 },
      },
      data: { quantity: { decrement: 3 } },
    });
  });

  it("не трогает строку товара, которого нет в заказе (AC-5)", async () => {
    tx.cartItem.findMany.mockResolvedValue([
      { productId: "p-1", quantity: 3 },
      { productId: "p-2", quantity: 9 },
    ]);

    await create();

    expect(tx.cartItem.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.cartItem.deleteMany.mock.calls[0][0].where.productId).toBe("p-1");
  });

  it("логирует пропуск, когда строку удалили между чтением и очисткой (AC-8)", async () => {
    tx.cartItem.findMany.mockResolvedValue([{ productId: "p-1", quantity: 3 }]);
    tx.cartItem.deleteMany.mockResolvedValue({ count: 0 });
    tx.cartItem.updateMany.mockResolvedValue({ count: 0 });
    const warn = console.warn as jest.Mock;

    await create();

    const events = warn.mock.calls.map(([line]) => JSON.parse(line as string));

    expect(events).toContainEqual(
      expect.objectContaining({
        event: "cart.clear.skipped",
        orderId: "order-1",
        productId: "p-1",
      }),
    );
  });

  it("прерывает транзакцию, когда очистка упала (AC-8)", async () => {
    tx.cartItem.deleteMany.mockRejectedValue(new Error("db is down"));

    await expect(create()).rejects.toThrow("db is down");
    expect(tx.order.create).toHaveBeenCalled();
  });
});
