import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import type { CreateOrderDto } from "./dto/create-order.dto";
import { OrderService } from "./order.service";

/**
 * These specs run against a real Postgres, because the conditional stock update
 * is only proven by two transactions competing for the same row. Enable with
 * `ORDER_DB_TESTS=1 pnpm --filter @astrum/api test`.
 */
const describeWithDatabase =
  process.env.ORDER_DB_TESTS === "1" ? describe : describe.skip;

describeWithDatabase("OrderService against a real database", () => {
  const userId = `order-test-${Date.now()}`;
  let productId = "";
  let shippingMethodId = "";

  const dtoFor = (overrides: Partial<CreateOrderDto> = {}): CreateOrderDto =>
    ({
      deliveryAddress: "Lenina 1",
      deliveryDate: new Date("2026-11-10T12:00:00.000Z") as never,
      shippingMethodId,
      paymentMethod: "CASH",
      paymentDetails: "Cash on delivery",
      orderItems: [{ productId, quantity: 1 }],
      ...overrides,
    }) as CreateOrderDto;

  beforeAll(async () => {
    await prisma.business.create({ data: { id: userId } });
    const shipping = await prisma.shippingMethod.create({
      data: { name: `Test delivery ${userId}`, price: 5.99 },
    });
    shippingMethodId = shipping.id;

    const product = await prisma.product.create({
      data: {
        businessId: userId,
        name: `Test drill ${userId}`,
        quantity: 5,
        price: 19.99,
        currency: "RUB",
        category: "Home",
        previewImage: "http://cdn/test-drill.png",
        images: [],
        visibility: "Public",
        status: "Published",
      },
    });
    productId = product.id;

    await prisma.cartItem.create({
      data: { userId, productId, quantity: 20 },
    });
  });

  afterAll(async () => {
    await prisma.orderItem.deleteMany({ where: { userId } });
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.cartItem.deleteMany({ where: { userId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.business.delete({ where: { id: userId } });
    await prisma.shippingMethod.deleteMany({ where: { id: shippingMethodId } });
    await prisma.$disconnect();
  });

  it("игнорирует цену и имя из тела и пишет цену товара (AC-1)", async () => {
    const { order } = await new OrderService().createOrder(
      userId,
      dtoFor({
        orderItems: [
          {
            productId,
            quantity: 1,
            price: 1,
            name: "lol",
            previewImage: "x",
          } as never,
        ],
      }),
    );

    expect(order.totalPrice.toFixed(2)).toBe("19.99");
    expect(order.currency).toBe("RUB");
    expect(order.orderItems[0].price.toFixed(2)).toBe("19.99");
    expect(order.orderItems[0].name).toBe(`Test drill ${userId}`);
  });

  it("укладывает 20 параллельных заказов на склад 5 без отрицательного остатка (AC-3, AC-4)", async () => {
    await prisma.product.update({
      where: { id: productId },
      data: { quantity: 5, isOutOfStock: false },
    });

    const attempts = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        new OrderService().createOrder(userId, dtoFor()),
      ),
    );

    const created = attempts.filter((result) => result.status === "fulfilled");
    const refused = attempts.filter((result) => result.status === "rejected");

    expect(created).toHaveLength(5);
    expect(refused).toHaveLength(15);

    for (const result of refused) {
      const error = (result as PromiseRejectedResult).reason;
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("OUT_OF_STOCK");
      const details = (error as AppError).details as {
        items: Array<{ requested: number; available: number }>;
      };
      expect(details.items).toHaveLength(1);
      expect(details.items[0].available).toBe(0);
    }

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });
    expect(product.quantity).toBe(0);
    expect(product.isOutOfStock).toBe(true);

    const lines = await prisma.orderItem.aggregate({
      where: { userId },
      _sum: { quantity: true },
    });
    const orders = await prisma.order.count({ where: { userId } });
    expect(orders).toBe(6);
    expect(lines._sum.quantity).toBe(6);
  }, 60000);

  it("возвращает остаток при отмене и не добавляет его второй раз (AC-1, AC-2, AC-5)", async () => {
    const localUser = `cancel-test-${Date.now()}`;
    await prisma.business.create({ data: { id: localUser } });
    const product = await prisma.product.create({
      data: {
        businessId: localUser,
        name: `Cancel drill ${localUser}`,
        quantity: 4,
        price: 10,
        currency: "RUB",
        category: "Home",
        previewImage: "http://cdn/cancel.png",
        images: [],
        visibility: "Public",
        status: "Published",
      },
    });
    await prisma.cartItem.create({
      data: { userId: localUser, productId: product.id, quantity: 3 },
    });

    const service = new OrderService();
    const { order } = await service.createOrder(localUser, {
      ...dtoFor(),
      orderItems: [{ productId: product.id, quantity: 3 }],
    } as CreateOrderDto);

    const taken = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(taken.quantity).toBe(1);

    const cancelled = await service.updateOrderStatus(
      order.id,
      localUser,
      "CANCELED",
    );

    const restored = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(cancelled.status).toBe("CANCELED");
    expect(cancelled.orderItems[0].status).toBe("CANCELLED");
    expect(restored.quantity).toBe(4);
    expect(restored.isOutOfStock).toBe(false);

    await service.updateOrderStatus(order.id, localUser, "CANCELED");

    const afterSecondCall = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(afterSecondCall.quantity).toBe(4);

    await prisma.orderItem.deleteMany({ where: { userId: localUser } });
    await prisma.order.deleteMany({ where: { userId: localUser } });
    await prisma.cartItem.deleteMany({ where: { userId: localUser } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.business.delete({ where: { id: localUser } });
  }, 30000);
});

describeWithDatabase("Idempotent checkout against a real database", () => {
  let shippingMethodId = "";

  beforeAll(async () => {
    const shipping = await prisma.shippingMethod.create({
      data: { name: `Idem delivery ${Date.now()}`, price: 5.99 },
    });
    shippingMethodId = shipping.id;
  });

  afterAll(async () => {
    await prisma.shippingMethod.deleteMany({ where: { id: shippingMethodId } });
    await prisma.$disconnect();
  });

  const provision = async (options: {
    stock: number;
    cart: number;
    orderQty: number;
  }) => {
    const owner = `idem-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await prisma.business.create({ data: { id: owner } });
    const product = await prisma.product.create({
      data: {
        businessId: owner,
        name: `Idem ${owner}`,
        quantity: options.stock,
        price: 10,
        currency: "RUB",
        category: "Home",
        previewImage: "http://cdn/idem.png",
        images: [],
        visibility: "Public",
        status: "Published",
      },
    });

    if (options.cart > 0) {
      await prisma.cartItem.create({
        data: { userId: owner, productId: product.id, quantity: options.cart },
      });
    }

    const dto = {
      deliveryAddress: "Lenin 1",
      deliveryDate: "2026-11-20T09:00:00.000Z",
      shippingMethodId,
      paymentMethod: "CASH",
      paymentDetails: "Cash",
      orderItems: [{ productId: product.id, quantity: options.orderQty }],
    } as unknown as CreateOrderDto;

    return { owner, product, dto };
  };

  const cleanup = async (owner: string, productId: string) => {
    await prisma.orderItem.deleteMany({ where: { userId: owner } });
    await prisma.order.deleteMany({ where: { userId: owner } });
    await prisma.cartItem.deleteMany({ where: { userId: owner } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.business.delete({ where: { id: owner } });
  };

  it("два запроса с одним ключом дают один заказ, одно списание и одну очистку (AC-2, AC-6, AC-5)", async () => {
    const { owner, product, dto } = await provision({
      stock: 5,
      cart: 2,
      orderQty: 2,
    });
    const key = `race-${Date.now()}`;

    const [first, second] = await Promise.all([
      new OrderService().createOrder(owner, dto, key),
      new OrderService().createOrder(owner, dto, key),
    ]);

    const orders = await prisma.order.findMany({ where: { userId: owner } });
    const stock = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    const cart = await prisma.cartItem.count({ where: { userId: owner } });

    expect(orders).toHaveLength(1);
    expect(first.order.id).toBe(second.order.id);
    expect([first.replay, second.replay].sort()).toEqual([false, true]);
    expect(stock.quantity).toBe(3);
    expect(cart).toBe(0);

    await cleanup(owner, product.id);
  }, 60000);

  it("оставляет остаток в корзине и не трогает невыбранный товар (AC-5)", async () => {
    const { owner, product, dto } = await provision({
      stock: 5,
      cart: 5,
      orderQty: 2,
    });
    const other = await prisma.product.create({
      data: {
        businessId: owner,
        name: `Untouched ${owner}`,
        quantity: 50,
        price: 10,
        currency: "RUB",
        category: "Home",
        previewImage: "http://cdn/other.png",
        images: [],
        visibility: "Public",
        status: "Published",
      },
    });
    await prisma.cartItem.create({
      data: { userId: owner, productId: other.id, quantity: 9 },
    });

    await new OrderService().createOrder(owner, dto, `partial-${Date.now()}`);

    const ordered = await prisma.cartItem.findFirstOrThrow({
      where: { userId: owner, productId: product.id },
    });
    const kept = await prisma.cartItem.findFirstOrThrow({
      where: { userId: owner, productId: other.id },
    });

    expect(ordered.quantity).toBe(3);
    expect(kept.quantity).toBe(9);

    await prisma.cartItem.deleteMany({ where: { userId: owner } });
    await prisma.product.delete({ where: { id: other.id } });
    await cleanup(owner, product.id);
  }, 30000);

  it("отказ не пишет ключ и не меняет корзину (AC-5)", async () => {
    const { owner, product, dto } = await provision({
      stock: 1,
      cart: 2,
      orderQty: 2,
    });
    const key = `refused-${Date.now()}`;

    const error = await new OrderService()
      .createOrder(owner, dto, key)
      .catch((caught: AppError) => caught);

    const stored = await prisma.order.count({
      where: { userId: owner, idempotencyKey: key },
    });
    const cart = await prisma.cartItem.findFirstOrThrow({
      where: { userId: owner, productId: product.id },
    });

    expect((error as AppError).code).toBe("OUT_OF_STOCK");
    expect(stored).toBe(0);
    expect(cart.quantity).toBe(2);

    await cleanup(owner, product.id);
  }, 30000);

  it("тот же ключ с другим телом отвечает 409 и пишет один заказ (AC-3)", async () => {
    const { owner, product, dto } = await provision({
      stock: 5,
      cart: 3,
      orderQty: 1,
    });
    const key = `conflict-${Date.now()}`;

    await new OrderService().createOrder(owner, dto, key);

    const error = await new OrderService()
      .createOrder(owner, { ...dto, deliveryAddress: "Lenin 2" }, key)
      .catch((caught: AppError) => caught);

    const orders = await prisma.order.count({ where: { userId: owner } });

    expect((error as AppError).status).toBe(409);
    expect((error as AppError).code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(orders).toBe(1);

    await cleanup(owner, product.id);
  }, 30000);
});
