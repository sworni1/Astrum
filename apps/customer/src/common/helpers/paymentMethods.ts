import { PaymentMethod } from "@/common/types/order.types";

export const CHOOSABLE_PAYMENT_METHODS = [
  PaymentMethod.ONLINE_CARD,
  PaymentMethod.CARD_ON_DELIVERY,
  PaymentMethod.CASH,
] as const;

export const CHECKOUT_METHOD_KEYS = {
  [PaymentMethod.ONLINE_CARD]: "paymentOnlineCard",
  [PaymentMethod.CARD_ON_DELIVERY]: "paymentCardOnDelivery",
  [PaymentMethod.CASH]: "paymentCash",
} as const;
