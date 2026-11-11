import { PaymentMethod, PaymentStatus } from "@/common/types/order.types";

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
