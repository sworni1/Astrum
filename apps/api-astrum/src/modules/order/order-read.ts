import { prisma } from "../../../lib/prisma";
import {
  ORDER_DETAIL_INCLUDE,
  ORDER_LIST_SELECT,
  ORDER_LIST_TRANSACTION_OPTIONS,
} from "./constants/order.constants";
import { orderNotFound } from "./helpers/order-errors.helpers";
import { countByStatus, spentByCurrency, toOrderDetail } from "./order.mapper";
import { orderListWhere } from "./order-query";
import type {
  OrderDetail,
  OrderListPage,
  OrderListQuery,
} from "./types/order.types";

export const getOrderById = async (
  orderId: string,
  userId: string,
): Promise<OrderDetail> => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: ORDER_DETAIL_INCLUDE,
  });

  if (!order) {
    throw orderNotFound();
  }

  const businessIds = [
    ...new Set(order.OrderItem.map((item) => item.businessId)),
  ];
  const productIds = [
    ...new Set(order.OrderItem.map((item) => item.productId)),
  ];

  const [businesses, products, paidAttempt] = await Promise.all([
    prisma.business.findMany({
      where: { id: { in: businessIds } },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, subcategory: true },
    }),
    prisma.payment.findFirst({
      where: { orderId, status: "PAID", paidAt: { not: null } },
      orderBy: { paidAt: "desc" },
      select: { paidAt: true },
    }),
  ]);

  return toOrderDetail(order, {
    paidAt: paidAttempt?.paidAt ?? null,
    brandNames: new Map(businesses.map((row) => [row.id, row.name])),
    kinds: new Map(products.map((row) => [row.id, row.subcategory])),
  });
};

export const getOrdersByUserId = async (
  userId: string,
  query: OrderListQuery = {},
): Promise<OrderListPage> => {
  const [rows, statusGroups, currencyGroups] = await prisma.$transaction(
    [
      prisma.order.findMany({
        where: orderListWhere(userId, query),
        orderBy: { createdAt: "desc" },
        select: ORDER_LIST_SELECT,
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: { userId },
        _count: { _all: true },
      }),
      prisma.order.groupBy({
        by: ["currency"],
        where: {
          userId,
          status: { not: "CANCELED" },
          AND: [
            {
              OR: [
                { paymentStatus: "PAID" },
                { status: { in: ["DELIVERED", "ISSUED"] } },
              ],
            },
          ],
        },
        _sum: { grandTotal: true },
      }),
    ],
    ORDER_LIST_TRANSACTION_OPTIONS,
  );

  return {
    items: rows.map(({ OrderItem, ...row }) => ({
      ...row,
      orderItems: OrderItem,
    })),
    counts: countByStatus(statusGroups),
    spent: spentByCurrency(currencyGroups),
  };
};
