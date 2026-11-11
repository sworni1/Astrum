import { PaymentMethod } from "@/common/types/order.types";

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
