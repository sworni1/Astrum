import { OrderItemStatus } from "@/common/types/order.types";

const DOT_RECEIVED = "bg-success";

const DOT_CANCELED = "bg-destructive-soft";

const DOT_NEUTRAL = "bg-muted-foreground";

export type LineStateLabelKey =
  | "itemStatus.pending"
  | "itemStatus.confirmed"
  | "itemStatus.outOfStock"
  | "itemStatus.cancelled"
  | "itemStatus.shipped"
  | "itemStatus.delivered"
  | "itemStatus.returned"
  | "itemStatus.backordered"
  | "itemStatus.replaced";

export type LineState = { labelKey: LineStateLabelKey; dot: string };

/**
 * Every member of `OrderItemStatus` is keyed explicitly: a member added later
 * renders its own label instead of falling through a boolean test
 * (spec 0025, AC-11).
 */
export const LINE_STATES: Record<OrderItemStatus, LineState> = {
  [OrderItemStatus.PENDING]: {
    labelKey: "itemStatus.pending",
    dot: DOT_NEUTRAL,
  },
  [OrderItemStatus.CONFIRMED]: {
    labelKey: "itemStatus.confirmed",
    dot: DOT_NEUTRAL,
  },
  [OrderItemStatus.OUT_OF_STOCK]: {
    labelKey: "itemStatus.outOfStock",
    dot: DOT_NEUTRAL,
  },
  [OrderItemStatus.CANCELLED]: {
    labelKey: "itemStatus.cancelled",
    dot: DOT_CANCELED,
  },
  [OrderItemStatus.SHIPPED]: {
    labelKey: "itemStatus.shipped",
    dot: DOT_NEUTRAL,
  },
  [OrderItemStatus.DELIVERED]: {
    labelKey: "itemStatus.delivered",
    dot: DOT_RECEIVED,
  },
  [OrderItemStatus.RETURNED]: {
    labelKey: "itemStatus.returned",
    dot: DOT_NEUTRAL,
  },
  [OrderItemStatus.BACKORDERED]: {
    labelKey: "itemStatus.backordered",
    dot: DOT_NEUTRAL,
  },
  [OrderItemStatus.REPLACED]: {
    labelKey: "itemStatus.replaced",
    dot: DOT_NEUTRAL,
  },
};

export const lineStateOf = (status: OrderItemStatus): LineState =>
  LINE_STATES[status];
