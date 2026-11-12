import {
  type Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/common/types/order.types";

/** The catalog keys under `orders.payment`; one per payment method. */
export type PaymentLabelKey =
  | "onlineCard"
  | "paypal"
  | "stripe"
  | "cardOnDelivery"
  | "cash";

/** One payment method to catalog key table, so a label is written once. */
export const PAYMENT_KEYS: Record<PaymentMethod, PaymentLabelKey> = {
  [PaymentMethod.ONLINE_CARD]: "onlineCard",
  [PaymentMethod.PAYPAL]: "paypal",
  [PaymentMethod.STRIPE]: "stripe",
  [PaymentMethod.CARD_ON_DELIVERY]: "cardOnDelivery",
  [PaymentMethod.CASH]: "cash",
};

/** The catalog keys under `orders.paymentStatus`; one per payment status. */
export type PaymentStatusKey =
  | "paid"
  | "pending"
  | "cancelled"
  | "failed"
  | "refunded";

/** One payment status to catalog key table, so a label is written once. */
export const PAYMENT_STATUS_KEYS: Record<string, PaymentStatusKey> = {
  [PaymentStatus.PAID]: "paid",
  [PaymentStatus.PENDING]: "pending",
  [PaymentStatus.CANCELLED]: "cancelled",
  [PaymentStatus.FAILED]: "failed",
  [PaymentStatus.REFUNDED]: "refunded",
};

/** A status outside the enum has no label; the screen prints the raw value. */
export const paymentStatusKey = (
  status: string,
): PaymentStatusKey | undefined => PAYMENT_STATUS_KEYS[status];

/**
 * A payment the customer tried that nobody has confirmed yet. The return branch
 * prints its copy only for this state, because a paid order is not payable any
 * more and would otherwise carry the "not confirmed" line (AC-14).
 */
export const paymentUnconfirmed = (order: Order): boolean =>
  order.paymentStatus === PaymentStatus.PENDING ||
  order.paymentStatus === PaymentStatus.FAILED;

const deadline = (order: Order): number | null =>
  order.paymentExpiresAt === null
    ? null
    : new Date(order.paymentExpiresAt).getTime();

/**
 * The pay control shows only for a live online card order: the right method, an
 * order nobody cancelled, a payment that is pending or failed, and a deadline
 * still ahead. The client clock is a hint; the server refusal is the authority
 * (AC-13).
 */
export const canPay = (order: Order, now: Date): boolean => {
  const expiresAt = deadline(order);

  return (
    order.paymentMethod === PaymentMethod.ONLINE_CARD &&
    order.status !== OrderStatus.CANCELED &&
    paymentUnconfirmed(order) &&
    expiresAt !== null &&
    expiresAt > now.getTime()
  );
};

/** The window closed but the sweep has not closed the order yet (AC-13). */
export const paymentWindowPassed = (order: Order, now: Date): boolean => {
  const expiresAt = deadline(order);

  return (
    order.paymentMethod === PaymentMethod.ONLINE_CARD &&
    order.status !== OrderStatus.CANCELED &&
    expiresAt !== null &&
    expiresAt <= now.getTime()
  );
};

/** Money left, then the order was cancelled: the customer is owed a refund (AC-12). */
export const refundOwed = (order: Order): boolean =>
  order.status === OrderStatus.CANCELED &&
  order.paymentStatus === PaymentStatus.PAID;
