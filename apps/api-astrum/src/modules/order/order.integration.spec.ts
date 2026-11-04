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
    await prisma.shippingMethod.deleteMany({ where: { id: shippingMethodId } });
    await prisma.$disconnect();
  });

  it("игнорирует цену и имя из тела и пишет цену товара (AC-1)", async () => {
    const order = await new OrderService().createOrder(
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
    const order = await service.createOrder(localUser, {
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
  }, 30000);
});
