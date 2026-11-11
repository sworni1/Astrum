import type {
  SellerOrderLine,
  SellerOrdersPage,
} from "@/common/types/order.types";

/** Writes one answered line into the page the client already holds. */
export const pageWithLine = (
  page: SellerOrdersPage,
  updated: SellerOrderLine,
): SellerOrdersPage => ({
  ...page,
  orders: page.orders.map((order) => ({
    ...order,
    orderItems: order.orderItems.map((line) =>
      line.id === updated.id ? { ...line, ...updated } : line,
    ),
  })),
});
