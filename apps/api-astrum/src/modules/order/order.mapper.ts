import type { Order } from "@astrum/db/client";
import { toMoney } from "../../common/helpers/money";
import type {
  OrderDetail,
  OrderDetailLine,
  OrderListPage,
} from "./order.service";

const toLineJson = (item: OrderDetailLine) => {
  const { businessId: _businessId, brandName, kind, ...visible } = item;

  // The shop, the kind and the line amount are the detail read's alone, so an
  // answer that never resolved them keeps its old shape (spec 0027, AC-1).
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

/**
 * The list answer carries the rows, the three counts and the spent total. The
 * rows arrive already narrowed by the query's `select`, so nothing here strips
 * a column; only the decimals become numbers (spec 0025, AC-1, AC-5, AC-6).
 */
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
