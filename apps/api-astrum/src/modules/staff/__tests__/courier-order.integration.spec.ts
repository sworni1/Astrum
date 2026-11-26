import { Prisma } from "@astrum/db/client";
import { prisma } from "../../../../lib/prisma";
import { CourierOrderService } from "../courier-order.service";

const describeWithDatabase =
  process.env.ORDER_DB_TESTS === "1" ? describe : describe.skip;

const errorCode = (error: unknown): string =>
  error instanceof Error
    ? ((error as { code?: string }).code ?? error.message)
    : String(error);

describeWithDatabase("Courier parcels against Postgres", () => {
  const suffix = `courier-${Date.now()}`;
  const buyerId = `${suffix}-buyer`;
  const firstCourierId = `${suffix}-courier-1`;
  const secondCourierId = `${suffix}-courier-2`;
  const businessId = `${suffix}-business`;
  const productIds: string[] = [];
  const orderIds: string[] = [];
  let shippingMethodId = "";

  const createOrder = async (options: {
    lineStatus?: "SHIPPED" | "DELIVERED";
    paymentStatus?: "PENDING" | "PAID";
    courierUserId?: string | null;
    address?: string;
  }) => {
    const order = await prisma.order.create({
      data: {
        userId: buyerId,
        totalPrice: new Prisma.Decimal("100.00"),
        currency: "RUB",
        paymentMethod: "CASH",
        paymentStatus: options.paymentStatus ?? "PENDING",
        status: "SHIPPED",
        deliveryAddress: options.address ?? "Tverskaya 12",
        deliveryDate: new Date("2026-12-05T09:00:00.000Z"),
        shippingMethodId,
        shippingMethodName: `${suffix} courier`,
        deliveryPrice: new Prisma.Decimal("0.00"),
        grandTotal: new Prisma.Decimal("100.00"),
        courierUserId: options.courierUserId ?? null,
        OrderItem: {
          create: productIds.map((productId, index) => ({
            productId,
            previewImage: "http://cdn/line.png",
            name: `Line ${index}`,
            quantity: 2,
            price: new Prisma.Decimal("50.00"),
            currency: "RUB" as const,
            status: options.lineStatus ?? "SHIPPED",
            userId: buyerId,
            businessId,
          })),
        },
      },
      select: { id: true },
    });

    orderIds.push(order.id);
    return order.id;
  };

  const stockOf = async (productId: string): Promise<number> => {
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: { quantity: true },
    });

    return product.quantity;
  };

  beforeAll(async () => {
    const user = (id: string) => ({
      id,
      email: `${id}@test.local`,
      passwordhash: "integration-test",
      gender: "Male" as const,
      preferredCategories: [],
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      status: "ACTIVE" as const,
    });

    await prisma.user.createMany({
      data: [user(buyerId), user(firstCourierId), user(secondCourierId)],
    });
    await prisma.business.create({
      data: { id: businessId, name: `Shop ${businessId}` },
    });

    for (const index of [1, 2]) {
      const product = await prisma.product.create({
        data: {
          businessId,
          name: `${suffix} product ${index}`,
          quantity: 10,
          price: 50,
          category: "Electronics",
          currency: "RUB",
          previewImage: "http://cdn/product.png",
          images: [],
        },
        select: { id: true },
      });

      productIds.push(product.id);
    }

    const shipping = await prisma.shippingMethod.create({
      data: { name: `${suffix} courier`, price: 0, isPickup: false },
      select: { id: true },
    });

    shippingMethodId = shipping.id;

    await prisma.courier.createMany({
      data: [{ userId: firstCourierId }, { userId: secondCourierId }],
    });
  });

  afterAll(async () => {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.business.deleteMany({ where: { id: businessId } });
    await prisma.courier.deleteMany({
      where: { userId: { in: [firstCourierId, secondCourierId] } },
    });
    await prisma.shippingMethod.deleteMany({ where: { id: shippingMethodId } });
    await prisma.user.deleteMany({
      where: { id: { in: [buyerId, firstCourierId, secondCourierId] } },
    });
  });

  it("answers the address on the mine list and none on the pool (AC-3)", async () => {
    const claimed = await createOrder({ courierUserId: firstCourierId });
    const free = await createOrder({});
    const service = new CourierOrderService();

    const mine = await service.listCourierOrders(
      firstCourierId,
      "mine",
      "1",
      "50",
    );
    const pool = await service.listCourierOrders(
      secondCourierId,
      "available",
      "1",
      "50",
    );

    const mineRow = mine.orders.find((order) => order.id === claimed);
    const poolRow = pool.orders.find((order) => order.id === free);

    expect(mineRow?.deliveryAddress).toBe("Tverskaya 12");
    expect(poolRow?.deliveryAddress).toBeNull();
    expect(pool.orders.some((order) => order.id === claimed)).toBe(false);
  });

  it("serialises two couriers claiming one parcel (AC-4, AC-14)", async () => {
    const orderId = await createOrder({});
    const service = new CourierOrderService();

    const results = await Promise.allSettled([
      service.claim(orderId, firstCourierId),
      service.claim(orderId, secondCourierId),
    ]);

    const accepted = results.filter((result) => result.status === "fulfilled");
    const refused = results.filter((result) => result.status === "rejected");

    expect(accepted).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(errorCode((refused[0] as PromiseRejectedResult).reason)).toBe(
      "ALREADY_CLAIMED",
    );

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { courierUserId: true },
    });

    expect([firstCourierId, secondCourierId]).toContain(stored.courierUserId);
  });

  it("serialises two presses on the handover and stamps one moment (AC-6, AC-14)", async () => {
    const orderId = await createOrder({ courierUserId: firstCourierId });
    const service = new CourierOrderService();

    const results = await Promise.allSettled([
      service.handOver(orderId, firstCourierId),
      service.handOver(orderId, firstCourierId),
    ]);

    const accepted = results.filter((result) => result.status === "fulfilled");
    const refused = results.filter((result) => result.status === "rejected");

    expect(accepted).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(errorCode((refused[0] as PromiseRejectedResult).reason)).toBe(
      "ALREADY_HANDED_OVER",
    );

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        status: true,
        paymentStatus: true,
        handedOverAt: true,
        courierUserId: true,
        OrderItem: { select: { status: true, receiptDate: true } },
      },
    });

    expect(order.status).toBe("DELIVERED");
    expect(order.paymentStatus).toBe("PAID");
    expect(order.courierUserId).toBe(firstCourierId);
    expect(order.handedOverAt).not.toBeNull();
    expect(
      order.OrderItem.every(
        (line) =>
          line.status === "DELIVERED" &&
          line.receiptDate?.getTime() === order.handedOverAt?.getTime(),
      ),
    ).toBe(true);
  });

  it("returns the stock of a cancelled parcel once, even with two lines of one product (AC-8)", async () => {
    const orderId = await createOrder({
      courierUserId: firstCourierId,
      paymentStatus: "PAID",
    });
    const service = new CourierOrderService();
    const before = await stockOf(productIds[0]);

    await service.cancelOrder(orderId, firstCourierId);

    expect(await stockOf(productIds[0])).toBe(before + 2);
    expect(await stockOf(productIds[1])).toBe(before + 2);

    await expect(
      service.cancelOrder(orderId, firstCourierId),
    ).rejects.toMatchObject({ code: "NOTHING_TO_CANCEL" });

    expect(await stockOf(productIds[0])).toBe(before + 2);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        status: true,
        paymentStatus: true,
        OrderItem: { select: { status: true } },
      },
    });

    expect(order.status).toBe("CANCELED");
    expect(order.paymentStatus).toBe("PAID");
    expect(order.OrderItem.every((line) => line.status === "CANCELLED")).toBe(
      true,
    );
  });

  it("refuses a foreign parcel on the handover and the cancel (AC-6, AC-8)", async () => {
    const orderId = await createOrder({ courierUserId: firstCourierId });
    const service = new CourierOrderService();

    await expect(
      service.handOver(orderId, secondCourierId),
    ).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
    await expect(
      service.cancelOrder(orderId, secondCourierId),
    ).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { courierUserId: true, status: true },
    });

    expect(stored.courierUserId).toBe(firstCourierId);
    expect(stored.status).toBe("SHIPPED");
  });
});
