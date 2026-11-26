import { Prisma } from "@astrum/db/client";
import { prisma } from "../../../../lib/prisma";
import { PointOrderService } from "../point-order.service";

const describeWithDatabase =
  process.env.ORDER_DB_TESTS === "1" ? describe : describe.skip;

const describeError = (error: unknown): string =>
  error instanceof Error
    ? `${(error as { code?: string }).code ?? ""}`
    : String(error);

describeWithDatabase("Point counter against Postgres", () => {
  const suffix = `point-${Date.now()}`;
  const buyerId = `${suffix}-buyer`;
  const workerId = `${suffix}-worker`;
  const businessId = `${suffix}-business`;
  const otherPointName = `${suffix} other point`;
  const productIds: string[] = [];
  const orderIds: string[] = [];
  let shippingMethodId = "";
  let pickupPointId = "";
  let otherPointId = "";

  const createOrder = async (options: {
    pickupPointId?: string;
    status?: "SHIPPED" | "CONFIRMED";
    lineStatus?: "SHIPPED" | "CONFIRMED";
    paymentStatus?: "PENDING" | "PAID";
  }) => {
    const point = options.pickupPointId ?? pickupPointId;
    const lineStatus = options.lineStatus ?? "SHIPPED";

    const order = await prisma.order.create({
      data: {
        userId: buyerId,
        totalPrice: new Prisma.Decimal("100.00"),
        currency: "RUB",
        paymentMethod: "CASH",
        paymentStatus: options.paymentStatus ?? "PENDING",
        status: options.status ?? "SHIPPED",
        deliveryDate: new Date("2026-12-05T09:00:00.000Z"),
        shippingMethodId,
        shippingMethodName: `${suffix} pickup`,
        deliveryPrice: new Prisma.Decimal("0.00"),
        grandTotal: new Prisma.Decimal("100.00"),
        pickupPointId: point,
        pickupPointName: `${suffix} point`,
        pickupPointAddress: "Lenina 1",
        OrderItem: {
          create: productIds.map((productId, index) => ({
            productId,
            previewImage: "http://cdn/line.png",
            name: `Line ${index}`,
            quantity: 2,
            price: new Prisma.Decimal("50.00"),
            currency: "RUB" as const,
            status: lineStatus,
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
      data: [user(buyerId), user(workerId)],
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
      data: { name: `${suffix} pickup`, price: 0, isPickup: true },
      select: { id: true },
    });

    shippingMethodId = shipping.id;

    const point = await prisma.pickupPoint.create({
      data: { name: `${suffix} point`, address: "Lenina 1" },
      select: { id: true },
    });

    pickupPointId = point.id;

    const otherPoint = await prisma.pickupPoint.create({
      data: { name: otherPointName, address: "Lenina 2" },
      select: { id: true },
    });

    otherPointId = otherPoint.id;

    await prisma.pointWorker.create({
      data: { userId: workerId, pickupPointId },
    });
  });

  afterAll(async () => {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.cartItem.deleteMany({ where: { userId: buyerId } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.business.deleteMany({ where: { id: businessId } });
    await prisma.pointWorker.deleteMany({ where: { userId: workerId } });
    await prisma.pickupPoint.deleteMany({
      where: { id: { in: [pickupPointId, otherPointId] } },
    });
    await prisma.shippingMethod.deleteMany({ where: { id: shippingMethodId } });
    await prisma.user.deleteMany({
      where: { id: { in: [buyerId, workerId] } },
    });
  });

  it("lists only this point's shipped orders (AC-1)", async () => {
    const listed = await createOrder({});
    const confirmed = await createOrder({
      status: "CONFIRMED",
      lineStatus: "CONFIRMED",
    });
    const foreign = await createOrder({ pickupPointId: otherPointId });

    const answer = await new PointOrderService().listPointOrders(
      pickupPointId,
      undefined,
      "50",
    );
    const ids = answer.orders.map((order) => order.id);

    expect(ids).toContain(listed);
    expect(ids).not.toContain(confirmed);
    expect(ids).not.toContain(foreign);
    expect(answer.total).toBeGreaterThanOrEqual(1);
    expect(answer.orders.every((order) => order.status === "SHIPPED")).toBe(
      true,
    );
  });

  it("serialises two workers pressing the handover at the same moment (AC-5)", async () => {
    const orderId = await createOrder({});
    const service = new PointOrderService();

    const results = await Promise.allSettled([
      service.handOver(orderId, workerId, pickupPointId),
      service.handOver(orderId, workerId, pickupPointId),
    ]);

    const refused = results.filter((result) => result.status === "rejected");
    const accepted = results.filter((result) => result.status === "fulfilled");

    expect(accepted).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(describeError((refused[0] as PromiseRejectedResult).reason)).toBe(
      "ALREADY_HANDED_OVER",
    );

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        handedOverAt: true,
        status: true,
        OrderItem: { select: { receiptDate: true, status: true } },
      },
    });

    expect(order.status).toBe("DELIVERED");
    expect(order.handedOverAt).not.toBeNull();
    expect(
      order.OrderItem.every(
        (line) =>
          line.status === "DELIVERED" &&
          line.receiptDate?.getTime() === order.handedOverAt?.getTime(),
      ),
    ).toBe(true);
  });

  it("returns the stock of a cancelled order once (AC-6, AC-7)", async () => {
    const orderId = await createOrder({});
    const service = new PointOrderService();
    const before = await Promise.all(productIds.map(stockOf));

    await service.cancelOrder(orderId, workerId, pickupPointId);
    await expect(
      service.cancelOrder(orderId, workerId, pickupPointId),
    ).rejects.toMatchObject({ code: "NOTHING_TO_CANCEL" });

    const after = await Promise.all(productIds.map(stockOf));

    expect(after).toEqual(before.map((quantity) => quantity + 2));

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true, OrderItem: { select: { status: true } } },
    });

    expect(order.status).toBe("CANCELED");
    expect(order.OrderItem.every((line) => line.status === "CANCELLED")).toBe(
      true,
    );
  });
});
