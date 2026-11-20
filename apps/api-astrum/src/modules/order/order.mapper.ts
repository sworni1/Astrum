import type { Order } from "@astrum/db/client";
import { toMoney } from "../../common/helpers/money";
import type {
  OrderDetail,
  OrderDetailLine,
  OrderListPage,
} from "./order.service";

const toLineJson = (item: OrderDetailLine) => {
  const { businessId: _businessId, brandName, kind, ...visible } = item;

  const resolved =
    brandName === undefined
      ? {}
      : {
          brandName,
          kind: kind ?? null,
          subtotal: toMoney(Number(item.price) * item.quantity),
        };

  return { ...visible, price: toMoney(item.price), ...resolved };
};

type OrderRow = Pick<Order, "idempotencyKey" | "idempotencyHash">;

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

export const toOrderListJson = (page: OrderListPage) => ({
  items: page.items.map((row) => ({
    ...row,
    grandTotal: toMoney(row.grandTotal),
  })),
  counts: page.counts,
  spent: page.spent.map((entry) => ({
    currency: entry.currency,
    amount: toMoney(entry.amount),
  })),
});
