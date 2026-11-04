import type { Order, OrderItem } from "../../../generated/prisma/client";
import type { OrderDetail } from "./order.service";

/** Money reaches JSON as a number with at most two decimals (AC-9). */
const toMoney = (value: Order["totalPrice"]): number =>
  Number(value.toFixed(2));

const toLineJson = (item: OrderItem) => ({
  ...item,
  price: toMoney(item.price),
});

export const toOrderJson = (order: OrderDetail) => ({
  ...order,
  totalPrice: toMoney(order.totalPrice),
  orderItems: order.orderItems.map(toLineJson),
});

export const toOrderListJson = (orders: Order[]) =>
  orders.map((order) => ({ ...order, totalPrice: toMoney(order.totalPrice) }));
