import type { Order, OrderItem } from "../../../generated/prisma/client";
import type { OrderDetail } from "./order.service";

/** Money reaches JSON as a number with at most two decimals (AC-9). */
const toMoney = (value: Order["totalPrice"]): number =>
  Number(value.toFixed(2));

const toLineJson = (item: OrderItem) => ({
  ...item,
  price: toMoney(item.price),
});

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
    orderItems: order.orderItems.map(toLineJson),
  };
};

export const toOrderListJson = (orders: Order[]) =>
  orders.map((order) => ({
    ...withoutIdempotency(order),
    totalPrice: toMoney(order.totalPrice),
  }));
