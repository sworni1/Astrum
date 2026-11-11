import { OrderItemStatus } from "@/common/types/order.types";

export type SellerAction =
  | "confirm"
  | "outOfStock"
  | "cancel"
  | "ship"
  | "deliver";

/** The target status of every action the panel offers. */
export const SELLER_ACTION_TARGET: Record<SellerAction, OrderItemStatus> = {
  confirm: OrderItemStatus.CONFIRMED,
  ship: OrderItemStatus.SHIPPED,
  deliver: OrderItemStatus.DELIVERED,
  cancel: OrderItemStatus.CANCELLED,
  outOfStock: OrderItemStatus.OUT_OF_STOCK,
};

/**
 * A client mirror of the transition table of spec 0002. It only hides
 * buttons; the gateway re checks every move. `actionMap.test.ts` compares it
 * with the table for all nine statuses.
 */
export const SELLER_LINE_ACTIONS: Record<string, readonly SellerAction[]> = {
  [OrderItemStatus.PENDING]: ["confirm", "outOfStock", "cancel"],
  [OrderItemStatus.CONFIRMED]: ["ship", "cancel"],
  [OrderItemStatus.SHIPPED]: ["deliver"],
  [OrderItemStatus.OUT_OF_STOCK]: [],
  [OrderItemStatus.CANCELLED]: [],
  [OrderItemStatus.DELIVERED]: [],
  [OrderItemStatus.RETURNED]: [],
  [OrderItemStatus.BACKORDERED]: [],
  [OrderItemStatus.REPLACED]: [],
};

/** Cancel and Out of stock ask first; the other three act at once. */
export const SELLER_CONFIRMING_ACTIONS: readonly SellerAction[] = [
  "cancel",
  "outOfStock",
];

export const sellerLineActions = (status: string): readonly SellerAction[] =>
  SELLER_LINE_ACTIONS[status] ?? [];

export const isConfirmingAction = (action: SellerAction): boolean =>
  SELLER_CONFIRMING_ACTIONS.includes(action);
