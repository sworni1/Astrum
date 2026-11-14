import { OrderItemStatus } from "@/common/types/order.types";

/** The one per line move a seller still owns: the item is gone (AC-6, AC-8). */
export type SellerAction = "gone";

/** The target status of every action the panel offers. */
export const SELLER_ACTION_TARGET: Record<SellerAction, OrderItemStatus> = {
  gone: OrderItemStatus.CANCELLED,
};

/**
 * A client mirror of the per line table of spec 0016, AC-5: the platform
 * confirms and ships, so a seller cancels a confirmed line and nothing else.
 * Every other status carries no move, so the table names only the one that does.
 * It only hides buttons; the gateway re checks every move.
 */
export const SELLER_LINE_ACTIONS: Record<string, readonly SellerAction[]> = {
  [OrderItemStatus.CONFIRMED]: ["gone"],
  // A paid line is shipped by the payment itself, and the seller must still be
  // able to report it gone, because that is the move that returns the money.
  [OrderItemStatus.SHIPPED]: ["gone"],
};

/** The one action asks first: the stock returns and the buyer may be owed. */
export const SELLER_CONFIRMING_ACTIONS: readonly SellerAction[] = ["gone"];

export const sellerLineActions = (status: string): readonly SellerAction[] =>
  SELLER_LINE_ACTIONS[status] ?? [];

export const isConfirmingAction = (action: SellerAction): boolean =>
  SELLER_CONFIRMING_ACTIONS.includes(action);
