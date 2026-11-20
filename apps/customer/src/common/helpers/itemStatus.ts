import { OrderItemStatus } from "@/common/types/order.types";

export type ItemStatusKey =
  | "pending"
  | "confirmed"
  | "outOfStock"
  | "cancelled"
  | "shipped"
  | "delivered"
  | "issued"
  | "returned"
  | "backordered"
  | "replaced";

export const ITEM_STATUS_KEYS: Record<OrderItemStatus, ItemStatusKey> = {
  [OrderItemStatus.PENDING]: "pending",
  [OrderItemStatus.CONFIRMED]: "confirmed",
  [OrderItemStatus.OUT_OF_STOCK]: "outOfStock",
  [OrderItemStatus.CANCELLED]: "cancelled",
  [OrderItemStatus.SHIPPED]: "shipped",
  [OrderItemStatus.DELIVERED]: "delivered",
  [OrderItemStatus.ISSUED]: "issued",
  [OrderItemStatus.RETURNED]: "returned",
  [OrderItemStatus.BACKORDERED]: "backordered",
  [OrderItemStatus.REPLACED]: "replaced",
};

export const itemStatusKey = (status: string): ItemStatusKey | undefined =>
  ITEM_STATUS_KEYS[status as OrderItemStatus];
