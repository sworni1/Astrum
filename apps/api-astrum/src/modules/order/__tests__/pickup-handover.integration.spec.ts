import { prisma } from "../../../../lib/prisma";
import type { CreateOrderDto } from "../dto/create-order.dto";
import { OrderService } from "../order.service";

const describeWithDatabase =
  process.env.ORDER_DB_TESTS === "1" ? describe : describe.skip;

describeWithDatabase("Pickup snapshot against Postgres", () => {
  const suffix = `pickup-${Date.now()}`;
  const customerId = `${suffix}-customer`;
  const sellerId = `${suffix}-owner`;
  const businessId = `${suffix}-business`;
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
        { id: sellerId, email: `${sellerId}@test.local` },
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
          id: businessId,
          name: `Shop ${businessId}`,
          ownerUserId: sellerId,
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
    await prisma.business.deleteMany({ where: { id: businessId } });
    await prisma.user.deleteMany({
      where: { id: { in: [customerId, sellerId] } },
    });
    await prisma.pickupPoint.deleteMany({ where: { id: pickupPointId } });
    await prisma.shippingMethod.deleteMany({ where: { id: shippingMethodId } });
    await prisma.$disconnect();
  });

  it("snapshots the pickup point and zeroes the delivery price (AC-7)", async () => {
    const product = await prisma.product.create({
      data: {
        businessId,
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
  }, 30000);
});
