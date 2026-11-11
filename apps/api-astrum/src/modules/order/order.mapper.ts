import type { Order, OrderItem } from "../../../generated/prisma/client";
import { toMoney } from "../../common/helpers/money";
import type { OrderDetail, OrderSummary } from "./order.service";

const toLineJson = (item: OrderItem) => {
  const { businessId: _businessId, ...visible } = item;

  return { ...visible, price: toMoney(item.price) };
};

type OrderRow = Pick<Order, "idempotencyKey" | "idempotencyHash">;

/**
 * Both idempotency columns stay inside the gateway: a key in an answer is one a
 * client could replay with, and the fingerprint is not the client's business
 * (spec 0003, AC-12).
 */
const withoutIdempotency = <T extends OrderRow>(
  row: T,
): Omit<T, "idempotencyKey" | "idempotencyHash"> => {
  const { idempotencyKey, idempotencyHash, ...rest } = row;

  return rest;
};

export const toOrderJson = (order: OrderDetail) => {
  const visible = withoutIdempotency(order);

  return {
    ...visible,
    totalPrice: toMoney(order.totalPrice),
    deliveryPrice: toMoney(order.deliveryPrice),
    grandTotal: toMoney(order.grandTotal),
    orderItems: order.orderItems.map(toLineJson),
  };
};

export const toOrderListJson = (orders: OrderSummary[]) =>
  orders.map((order) => ({
    ...withoutIdempotency(order),
    totalPrice: toMoney(order.totalPrice),
    deliveryPrice: toMoney(order.deliveryPrice),
    grandTotal: toMoney(order.grandTotal),
  }));
