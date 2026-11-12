import { PaymentMethod } from "@/common/types/order.types";

/**
 * The methods a customer may choose on a new order: the enum keeps all five so
 * old orders still print their labels, but only these three are selectable and
 * accepted by the gateway (spec 0015, AC-3).
 */
export const CHOOSABLE_PAYMENT_METHODS = [
  PaymentMethod.ONLINE_CARD,
  PaymentMethod.CARD_ON_DELIVERY,
  PaymentMethod.CASH,
] as const;

/** The label key of each choosable method in the `cart` catalog. */
export const CHECKOUT_METHOD_KEYS = {
  [PaymentMethod.ONLINE_CARD]: "paymentOnlineCard",
  [PaymentMethod.CARD_ON_DELIVERY]: "paymentCardOnDelivery",
  [PaymentMethod.CASH]: "paymentCash",
} as const;
