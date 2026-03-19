import { Order } from '../../../generated/prisma/client';
import { prisma } from '../../../lib/prisma';
import { CreateOrderDto } from './dto/create-order.dto';

export class OrderService {
  async createOrder(userId: string, dto: CreateOrderDto) {
    const {
      deliveryAddress,
      deliveryDate,
      shippingMethodId,
      orderItems,
      paymentDetails,
      paymentMethod,
    } = dto;

    const totalPrice = orderItems.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0,
    );

    const order = await prisma.order.create({
      data: {
        userId,
        paymentMethod,
        paymentDetails,
        totalPrice,
        deliveryAddress,
        deliveryDate,
        shippingMethodId,
        OrderItem: {
          create: orderItems.map((item) => ({
            ...item,
            userId,
          })),
        },
      },
    });

    return order;
  }

  async getOrderById(orderId: Order['id']) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        OrderItem: true,
      },
    });

    if (!order) {
      throw new Error('getOrderById error');
    }

    const shippingMethod = await prisma.shippingMethod.findUnique({
      where: { id: order.shippingMethodId },
    });

    if (!shippingMethod) {
      throw new Error('getOrderById error');
    }

    const orderData = {
      ...order,
      shippingMethod: {
        name: shippingMethod.name,
        price: shippingMethod.price,
      },
      orderItems: order.OrderItem.map((item) => ({
        ...item,
      })),
    };

    return orderData;
  }

  async getOrdersByUserId(userId: string) {
    return prisma.order.findMany({
      where: { userId },
    });
  }
}
