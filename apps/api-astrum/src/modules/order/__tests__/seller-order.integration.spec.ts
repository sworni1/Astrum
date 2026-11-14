import { prisma } from "../../../../lib/prisma";
import type { CreateOrderDto } from "../dto/create-order.dto";
import { OrderService } from "../order.service";
import { SellerOrderService } from "../seller-order.service";

const describeWithDatabase =
  process.env.ORDER_DB_TESTS === "1" ? describe : describe.skip;

describeWithDatabase("Seller order workflow against Postgres", () => {
  const suffix = `seller-${Date.now()}`;
  const customerId = `${suffix}-customer`;
  const secondCustomerId = `${customerId}-second`;
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
    await prisma.cartItem.deleteMany({
      where: { userId: { in: [customerId, secondCustomerId] } },
    });
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

  it("snapshots ownership, scopes seller reads, and enforces transitions (AC-4 to AC-9, AC-12)", async () => {
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
    const orders = await sellers.getSellerOrders(sellerId);
    expect(orders.total).toBe(1);
    expect(orders.orders[0].orderItems.map((item) => item.id)).toEqual([
      sellerLine.id,
    ]);
    expect(orders.orders[0].orderItems[0].name).toBe(`${suffix} drill`);
    expect(orders.orders[0]).not.toHaveProperty("totalPrice");
    expect(orders.orders[0].orderItems[0]).not.toHaveProperty("businessId");
    expect(orders.orders[0].orderItems[0]).not.toHaveProperty("userId");

    await expect(
      sellers.updateSellerOrderItemStatus(otherLine.id, sellerId, "CONFIRMED"),
    ).rejects.toMatchObject({ status: 404, code: "ORDER_ITEM_NOT_FOUND" });

    await sellers.updateSellerOrderItemStatus(
      sellerLine.id,
      sellerId,
      "CONFIRMED",
    );
    await sellers.updateSellerOrderItemStatus(
      sellerLine.id,
      sellerId,
      "SHIPPED",
    );
    await sellers.updateSellerOrderItemStatus(
      otherLine.id,
      otherSellerId,
      "OUT_OF_STOCK",
    );
    const shippedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(shippedOrder.status).toBe("SHIPPED");

    await sellers.updateSellerOrderItemStatus(
      sellerLine.id,
      sellerId,
      "DELIVERED",
    );
    const deliveredOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(deliveredOrder.status).toBe("DELIVERED");
    expect(deliveredOrder.totalPrice.toFixed(2)).toBe("40.00");
    await expect(
      new OrderService().updateOrderStatus(order.id, customerId, "CANCELED"),
    ).rejects.toMatchObject({
      status: 409,
      code: "INVALID_STATUS_TRANSITION",
    });

    const cancellationProduct = await createProduct(
      businessId,
      `${suffix} cancellation`,
      5,
    );
    const cancellationOrder = await placeOrder(customerId, [
      { productId: cancellationProduct.id, quantity: 3 },
    ]);
    const cancellationLine = cancellationOrder.orderItems[0];
    await sellers.updateSellerOrderItemStatus(
      cancellationLine.id,
      sellerId,
      "CANCELLED",
    );
    await sellers.updateSellerOrderItemStatus(
      cancellationLine.id,
      sellerId,
      "CANCELLED",
    );

    const restored = await prisma.product.findUniqueOrThrow({
      where: { id: cancellationProduct.id },
    });
    expect(restored.quantity).toBe(5);
    expect(restored.isOutOfStock).toBe(false);
  }, 30000);

  it("does not restore stock for a line marked out of stock (AC-9)", async () => {
    const product = await createProduct(businessId, `${suffix} unavailable`, 3);
    const order = await placeOrder(customerId, [
      { productId: product.id, quantity: 2 },
    ]);

    await new SellerOrderService().updateSellerOrderItemStatus(
      order.orderItems[0].id,
      sellerId,
      "OUT_OF_STOCK",
    );

    const [updatedProduct, updatedOrder] = await Promise.all([
      prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
      prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
    ]);
    expect(updatedProduct.quantity).toBe(1);
    expect(updatedProduct.isOutOfStock).toBe(false);
    expect(updatedOrder.status).toBe("CANCELED");
  }, 30000);

  it("serializes duplicate cancels and preserves concurrent stock returns (AC-9, AC-11)", async () => {
    const product = await createProduct(businessId, `${suffix} shared`, 3);
    const firstOrder = await placeOrder(customerId, [
      { productId: product.id, quantity: 1 },
    ]);
    const secondOrder = await placeOrder(secondCustomerId, [
      { productId: product.id, quantity: 1 },
    ]);
    const thirdOrder = await placeOrder(customerId, [
      { productId: product.id, quantity: 1 },
    ]);
    const sellers = new SellerOrderService();

    await Promise.all([
      sellers.updateSellerOrderItemStatus(
        firstOrder.orderItems[0].id,
        sellerId,
        "CANCELLED",
      ),
      sellers.updateSellerOrderItemStatus(
        firstOrder.orderItems[0].id,
        sellerId,
        "CANCELLED",
      ),
      sellers.updateSellerOrderItemStatus(
        firstOrder.orderItems[0].id,
        sellerId,
        "CANCELLED",
      ),
      sellers.updateSellerOrderItemStatus(
        secondOrder.orderItems[0].id,
        sellerId,
        "CANCELLED",
      ),
      sellers.updateSellerOrderItemStatus(
        thirdOrder.orderItems[0].id,
        sellerId,
        "CANCELLED",
      ),
    ]);

    const restored = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(restored.quantity).toBe(3);
    expect(restored.isOutOfStock).toBe(false);
  }, 30000);
});
