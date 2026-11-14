import { prisma } from "../../../../lib/prisma";
import type { CreateOrderDto } from "../dto/create-order.dto";
import { OrderService } from "../order.service";
import { SellerOrderService } from "../seller-order.service";

const describeWithDatabase =
  process.env.ORDER_DB_TESTS === "1" ? describe : describe.skip;

describeWithDatabase("Seller order read against Postgres", () => {
  const suffix = `seller-${Date.now()}`;
  const customerId = `${suffix}-customer`;
  const sellerId = `${suffix}-owner`;
  const otherSellerId = `${suffix}-other`;
  const businessId = `${suffix}-business`;
  const otherBusinessId = `${suffix}-other-business`;
  const productIds: string[] = [];
  const orderIds: string[] = [];
  let shippingMethodId = "";

  const createProduct = async (
    ownerBusinessId: string,
    name: string,
    quantity: number,
  ) => {
    const product = await prisma.product.create({
      data: {
        businessId: ownerBusinessId,
        name,
        quantity,
        price: 10,
        currency: "RUB",
        category: "Home",
        previewImage: "https://cdn.test/seller-order.png",
        images: [],
        visibility: "Public",
        status: "Published",
      },
    });
    productIds.push(product.id);
    return product;
  };

  const placeOrder = async (
    userId: string,
    items: Array<{ productId: string; quantity: number }>,
  ) => {
    await prisma.cartItem.createMany({
      data: items.map((item) => ({ userId, ...item })),
    });
    const result = await new OrderService().createOrder(userId, {
      deliveryAddress: "Test address",
      deliveryDate: "2026-11-20T09:00:00.000Z",
      shippingMethodId,
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
        {
          id: sellerId,
          email: `${sellerId}@test.local`,
          passwordhash: "integration-test",
          gender: "Male",
          preferredCategories: [],
          dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        },
        {
          id: otherSellerId,
          email: `${otherSellerId}@test.local`,
          passwordhash: "integration-test",
          gender: "Female",
          preferredCategories: [],
          dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        },
      ],
    });
    await prisma.business.createMany({
      data: [
        { id: businessId, name: `Shop ${businessId}`, ownerUserId: sellerId },
        {
          id: otherBusinessId,
          name: `Shop ${otherBusinessId}`,
          ownerUserId: otherSellerId,
        },
      ],
    });
    const shipping = await prisma.shippingMethod.create({
      data: { name: `${suffix} delivery`, price: 5.99 },
    });
    shippingMethodId = shipping.id;
  });

  afterAll(async () => {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.cartItem.deleteMany({ where: { userId: customerId } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.business.deleteMany({
      where: { id: { in: [businessId, otherBusinessId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [sellerId, otherSellerId] } },
    });
    await prisma.shippingMethod.deleteMany({ where: { id: shippingMethodId } });
    await prisma.$disconnect();
  });

  it("snapshots ownership and scopes every seller read to it (AC-6)", async () => {
    const sellerProduct = await createProduct(
      businessId,
      `${suffix} drill`,
      10,
    );
    const otherProduct = await createProduct(
      otherBusinessId,
      `${suffix} saw`,
      10,
    );
    const order = await placeOrder(customerId, [
      { productId: sellerProduct.id, quantity: 2 },
      { productId: otherProduct.id, quantity: 2 },
    ]);
    await prisma.product.delete({ where: { id: sellerProduct.id } });
    const sellerLine = order.orderItems.find(
      (item) => item.productId === sellerProduct.id,
    );
    const otherLine = order.orderItems.find(
      (item) => item.productId === otherProduct.id,
    );

    if (!sellerLine || !otherLine) {
      throw new Error("Order creation did not return both expected lines.");
    }

    expect(sellerLine.businessId).toBe(businessId);

    const sellers = new SellerOrderService();
    const ownRead = await sellers.getSellerOrders(sellerId);
    const otherRead = await sellers.getSellerOrders(otherSellerId);

    expect(ownRead.total).toBe(1);
    expect(ownRead.orders[0].orderItems.map((item) => item.id)).toEqual([
      sellerLine.id,
    ]);
    expect(ownRead.orders[0].orderItems[0].name).toBe(`${suffix} drill`);
    expect(ownRead.orders[0]).not.toHaveProperty("totalPrice");
    expect(ownRead.orders[0].orderItems[0]).not.toHaveProperty("businessId");
    expect(ownRead.orders[0].orderItems[0]).not.toHaveProperty("userId");
    expect(otherRead.orders[0].orderItems.map((item) => item.id)).toEqual([
      otherLine.id,
    ]);
  }, 30000);
});
