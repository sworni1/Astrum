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

/**
 * One status to catalog key table for the `orders.itemStatus` messages. The
 * customer order screen and the seller panel both read it, so a label is
 * written once. The `Record` names every member, so a status added later is a
 * type error instead of a screen printing the raw word (spec 0031, AC-7).
 */
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

/** An unknown status has no label; the screen shows the raw value instead. */
export const itemStatusKey = (status: string): ItemStatusKey | undefined =>
  ITEM_STATUS_KEYS[status as OrderItemStatus];
