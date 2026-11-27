import type { Currency } from "@astrum/db/client";
import { toMoney } from "../../common/helpers/money";
import { SOLD_LINE_STATUSES } from "./constants/order.constants";
import { CANCELED_LINE_STATUSES } from "./constants/seller-order.constants";
import type {
  SellerAggregateRow,
  SellerLineCounts,
  SellerLineJson,
  SellerLineSource,
  SellerSalesStats,
} from "./types/seller-order.types";

export const toSellerOrderLineJson = (
  row: SellerLineSource,
): SellerLineJson => ({
  id: row.id,
  orderId: row.orderId,
  productId: row.productId,
  name: row.name,
  previewImage: row.previewImage,
  quantity: row.quantity,
  price: toMoney(row.price),
  subtotal: toMoney(row.price.mul(row.quantity)),
  currency: row.currency,
  status: row.status,
  createdAt: row.order.createdAt,
  isPickup: row.order.shippingMethod.isPickup,
  pickupPointName: row.order.pickupPointName,
  pickupPointAddress: row.order.pickupPointAddress,
  handedOverAt: row.order.handedOverAt,
  deliveryAddress: row.order.deliveryAddress,
});

const countOf = (
  rows: SellerAggregateRow[],
  statuses: readonly string[],
): number =>
  rows
    .filter((row) => statuses.includes(row.status))
    .reduce((total, row) => total + row.count, 0);

export const toCounts = (rows: SellerAggregateRow[]): SellerLineCounts => ({
  all: rows.reduce((total, row) => total + row.count, 0),
  delivered: countOf(rows, SOLD_LINE_STATUSES),
  canceled: countOf(rows, CANCELED_LINE_STATUSES),
});

export const toStats = (rows: SellerAggregateRow[]): SellerSalesStats => {
  const sold = rows.filter((row) =>
    SOLD_LINE_STATUSES.some((status) => status === row.status),
  );
  const byCurrency = new Map<Currency, number>();

  for (const row of sold) {
    byCurrency.set(
      row.currency,
      (byCurrency.get(row.currency) ?? 0) + Number(row.revenue),
    );
  }

  const revenue = [...byCurrency]
    .map(([currency, amount]) => ({ currency, amount: toMoney(amount) }))
    .sort((left, right) => left.currency.localeCompare(right.currency));

  return {
    revenue,
    units: sold.reduce((total, row) => total + Number(row.units), 0),
  };
};
