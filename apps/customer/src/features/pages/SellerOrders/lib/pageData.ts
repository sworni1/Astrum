import type {
  SellerOrderGroup,
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

/** Writes one answered group, with its delivered lines and handover date. */
export const pageWithGroup = (
  page: SellerOrdersPage,
  updated: SellerOrderGroup,
): SellerOrdersPage => ({
  ...page,
  orders: page.orders.map((order) =>
    order.id === updated.id ? updated : order,
  ),
});
