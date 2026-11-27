import {
  type Order,
  OrderItemStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/common/types/order.types";

export type PaymentLabelKey =
  | "onlineCard"
  | "paypal"
  | "stripe"
  | "cardOnDelivery"
  | "cash";

export const PAYMENT_KEYS: Record<PaymentMethod, PaymentLabelKey> = {
  [PaymentMethod.ONLINE_CARD]: "onlineCard",
  [PaymentMethod.PAYPAL]: "paypal",
  [PaymentMethod.STRIPE]: "stripe",
  [PaymentMethod.CARD_ON_DELIVERY]: "cardOnDelivery",
  [PaymentMethod.CASH]: "cash",
};

export type PaymentStatusKey =
  | "paid"
  | "pending"
  | "cancelled"
  | "failed"
  | "refunded";

export const PAYMENT_STATUS_KEYS: Record<string, PaymentStatusKey> = {
  [PaymentStatus.PAID]: "paid",
  [PaymentStatus.PENDING]: "pending",
  [PaymentStatus.CANCELLED]: "cancelled",
  [PaymentStatus.FAILED]: "failed",
  [PaymentStatus.REFUNDED]: "refunded",
};

export const paymentStatusKey = (
  status: string,
): PaymentStatusKey | undefined => PAYMENT_STATUS_KEYS[status];

export const paymentUnconfirmed = (order: Order): boolean =>
  order.paymentStatus === PaymentStatus.PENDING ||
  order.paymentStatus === PaymentStatus.FAILED;

const deadline = (order: Order): number | null =>
  order.paymentExpiresAt === null
    ? null
    : new Date(order.paymentExpiresAt).getTime();

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

export const paymentWindowPassed = (order: Order, now: Date): boolean => {
  const expiresAt = deadline(order);

  return (
    order.paymentMethod === PaymentMethod.ONLINE_CARD &&
    order.status !== OrderStatus.CANCELED &&
    expiresAt !== null &&
    expiresAt <= now.getTime()
  );
};

export const refundOwed = (order: Order): boolean =>
  order.status === OrderStatus.CANCELED &&
  order.paymentStatus === PaymentStatus.PAID;

export const lineRefundOwed = (order: Order): boolean =>
  order.paymentStatus === PaymentStatus.PAID &&
  order.orderItems.some((item) => item.status === OrderItemStatus.CANCELLED);
