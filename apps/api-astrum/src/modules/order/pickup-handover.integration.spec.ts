import { prisma } from "../../../lib/prisma";
import type { CreateOrderDto } from "./dto/create-order.dto";
import { OrderService } from "./order.service";
import { SellerOrderService } from "./seller-order.service";

const describeWithDatabase =
  process.env.ORDER_DB_TESTS === "1" ? describe : describe.skip;

describeWithDatabase("Pickup handover against Postgres", () => {
  const suffix = `pickup-${Date.now()}`;
  const customerId = `${suffix}-customer`;
  const firstSellerId = `${suffix}-owner`;
  const secondSellerId = `${suffix}-second-owner`;
  const firstBusinessId = `${suffix}-business`;
  const secondBusinessId = `${suffix}-second-business`;
  const productIds: string[] = [];
  const orderIds: string[] = [];
  let shippingMethodId = "";
  let pickupPointId = "";

  const placePickupOrder = async (
    items: Array<{ productId: string; quantity: number }>,
  ) => {
    await prisma.cartItem.createMany({
      data: items.map((item) => ({ userId: customerId, ...item })),
    });
    const result = await new OrderService().createOrder(customerId, {
      deliveryAddress: "Ignored on a pickup order",
      deliveryDate: "2026-12-05T09:00:00.000Z",
      shippingMethodId,
      pickupPointId,
      paymentMethod: "CASH",
      paymentDetails: "Cash",
      orderItems: items,
    } as unknown as CreateOrderDto);
    orderIds.push(result.order.id);
    return result.order;
  };

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        { id: customerId, email: `${customerId}@test.local` },
        { id: firstSellerId, email: `${firstSellerId}@test.local` },
        { id: secondSellerId, email: `${secondSellerId}@test.local` },
      ].map((user) => ({
        ...user,
        passwordhash: "integration-test",
        gender: "Male" as const,
        preferredCategories: [],
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      })),
    });
    await prisma.business.createMany({
      data: [
        {
          id: firstBusinessId,
          name: `Shop ${firstBusinessId}`,
          ownerUserId: firstSellerId,
        },
        {
          id: secondBusinessId,
          name: `Shop ${secondBusinessId}`,
          ownerUserId: secondSellerId,
        },
      ],
    });
    const shipping = await prisma.shippingMethod.create({
      data: { name: `${suffix} pickup`, price: 0, isPickup: true },
    });
    shippingMethodId = shipping.id;
    const point = await prisma.pickupPoint.create({
      data: { name: `${suffix} point`, address: "Tverskaya 12, Moscow" },
    });
    pickupPointId = point.id;
  });

  afterAll(async () => {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.cartItem.deleteMany({ where: { userId: customerId } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.business.deleteMany({
      where: { id: { in: [firstBusinessId, secondBusinessId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [customerId, firstSellerId, secondSellerId] } },
    });
    await prisma.pickupPoint.deleteMany({ where: { id: pickupPointId } });
    await prisma.shippingMethod.deleteMany({ where: { id: shippingMethodId } });
    await prisma.$disconnect();
  });

  it("хранит снимок точки и нулевую доставку, затем выдаёт заказ одним действием (AC-7, AC-11)", async () => {
    const product = await prisma.product.create({
      data: {
        businessId: firstBusinessId,
        name: `${suffix} drill`,
        quantity: 5,
        price: 19.99,
        currency: "RUB",
        category: "Home",
        previewImage: "https://cdn.test/pickup.png",
        images: [],
        visibility: "Public",
        status: "Published",
      },
    });
    productIds.push(product.id);

    const order = await placePickupOrder([
      { productId: product.id, quantity: 2 },
    ]);

    expect(order.pickupPointId).toBe(pickupPointId);
    expect(order.pickupPointName).toBe(`${suffix} point`);
    expect(order.pickupPointAddress).toBe("Tverskaya 12, Moscow");
    expect(order.deliveryAddress).toBeNull();
    expect(order.deliveryPrice.toFixed(2)).toBe("0.00");
    expect(order.grandTotal.toFixed(2)).toBe(order.totalPrice.toFixed(2));

    const sellers = new SellerOrderService();
    const line = order.orderItems[0];
    await sellers.updateSellerOrderItemStatus(line.id, firstSellerId, "CONFIRMED");

    const group = await sellers.handOverOrder(order.id, firstSellerId);
    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });

    expect(group.orderItems[0].status).toBe("DELIVERED");
    expect(stored.status).toBe("DELIVERED");
    expect(stored.handedOverAt).not.toBeNull();

    const deliveredLine = await prisma.orderItem.findUniqueOrThrow({
      where: { id: line.id },
    });
    expect(deliveredLine.receiptDate).not.toBeNull();
  }, 30000);

  it("сериализует выдачу двумя продавцами и пишет дату один раз (AC-11)", async () => {
    const firstProduct = await prisma.product.create({
      data: {
        businessId: firstBusinessId,
        name: `${suffix} first`,
        quantity: 5,
        price: 10,
        currency: "RUB",
        category: "Home",
        previewImage: "https://cdn.test/first.png",
        images: [],
        visibility: "Public",
        status: "Published",
      },
    });
    const secondProduct = await prisma.product.create({
      data: {
        businessId: secondBusinessId,
        name: `${suffix} second`,
        quantity: 5,
        price: 10,
        currency: "RUB",
        category: "Home",
        previewImage: "https://cdn.test/second.png",
        images: [],
        visibility: "Public",
        status: "Published",
      },
    });
    productIds.push(firstProduct.id, secondProduct.id);

    const order = await placePickupOrder([
      { productId: firstProduct.id, quantity: 1 },
      { productId: secondProduct.id, quantity: 1 },
    ]);
    const sellers = new SellerOrderService();
    const firstLine = order.orderItems.find(
      (item) => item.productId === firstProduct.id,
    );
    const secondLine = order.orderItems.find(
      (item) => item.productId === secondProduct.id,
    );

    if (!firstLine || !secondLine) {
      throw new Error("Order creation did not return both expected lines.");
    }

    await sellers.updateSellerOrderItemStatus(firstLine.id, firstSellerId, "CONFIRMED");
    await sellers.updateSellerOrderItemStatus(secondLine.id, secondSellerId, "CONFIRMED");

    await Promise.all([
      sellers.handOverOrder(order.id, firstSellerId),
      sellers.handOverOrder(order.id, secondSellerId),
    ]);

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    const lines = await prisma.orderItem.findMany({
      where: { orderId: order.id },
    });

    expect(stored.status).toBe("DELIVERED");
    expect(stored.handedOverAt).not.toBeNull();
    expect(lines.every((line) => line.status === "DELIVERED")).toBe(true);
    expect(lines.every((line) => line.receiptDate !== null)).toBe(true);
  }, 30000);
});
