import type { OrderItemStatus } from "@astrum/db/enums";

export const STAFF_ORDER_LINE_SELECT = {
  id: true,
  name: true,
  previewImage: true,
  quantity: true,
  price: true,
  currency: true,
  status: true,
} as const;

export const STAFF_ORDER_CANCEL_LINE_SELECT = {
  ...STAFF_ORDER_LINE_SELECT,
  productId: true,
} as const;

export const CANCELLABLE_STATUSES: readonly OrderItemStatus[] = [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
];
