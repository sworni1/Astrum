import { Check, type LucideIcon, Package, Truck } from "lucide-react";
import { OrderStatus } from "@/common/types/order.types";

/** The three tone sets of spec 0027, AC-8. */
export type PillTone = "success" | "destructive" | "neutral";

/** The catalog keys under `orders.status`; one per order status. */
export type StatusLabelKey =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "canceled";

/** One status to catalog key table, so a label is written once. */
export const STATUS_KEYS: Record<OrderStatus, StatusLabelKey> = {
  [OrderStatus.PENDING]: "pending",
  [OrderStatus.CONFIRMED]: "confirmed",
  [OrderStatus.SHIPPED]: "shipped",
  [OrderStatus.DELIVERED]: "delivered",
  [OrderStatus.CANCELED]: "canceled",
};

/**
 * The statuses the gateway still accepts a cancel from (spec 0011, AC-1); every
 * other status renders no cancel action at all.
 */
const CANCELLABLE_STATUSES: readonly OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
];

export const canCancel = (status: OrderStatus): boolean =>
  CANCELLABLE_STATUSES.includes(status);

/**
 * The pill tone of every order status: a delivered parcel reads success, a
 * canceled order reads destructive, the steps in between stay neutral, so no
 * status lands without a tone (spec 0027, AC-8).
 */
export const STATUS_TONES: Record<OrderStatus, PillTone> = {
  [OrderStatus.PENDING]: "neutral",
  [OrderStatus.CONFIRMED]: "neutral",
  [OrderStatus.SHIPPED]: "neutral",
  [OrderStatus.DELIVERED]: "success",
  [OrderStatus.CANCELED]: "destructive",
};

export type DeliveryStep = {
  status: OrderStatus;
  key: StatusLabelKey;
  icon: LucideIcon;
};

/** The four steps a parcel walks, in order. A cancelled order shows none of them. */
export const DELIVERY_STEPS: readonly DeliveryStep[] = [
  { status: OrderStatus.PENDING, key: "pending", icon: Check },
  { status: OrderStatus.CONFIRMED, key: "confirmed", icon: Check },
  { status: OrderStatus.SHIPPED, key: "shipped", icon: Package },
  { status: OrderStatus.DELIVERED, key: "delivered", icon: Truck },
];

export const DELIVERY_PROGRESS: Record<OrderStatus, number> = {
  [OrderStatus.PENDING]: 0,
  [OrderStatus.CONFIRMED]: 33.33,
  [OrderStatus.SHIPPED]: 66.67,
  [OrderStatus.DELIVERED]: 100,
  [OrderStatus.CANCELED]: 0,
};

/**
 * How far the parcel got: -1 means no step is reached, which covers a cancelled
 * order and a status this storefront does not know.
 */
export const statusStepIndex = (status: OrderStatus): number => {
  switch (status) {
    case OrderStatus.PENDING:
      return 0;
    case OrderStatus.CONFIRMED:
      return 1;
    case OrderStatus.SHIPPED:
      return 2;
    case OrderStatus.DELIVERED:
      return 3;
    default:
      return -1;
  }
};

export type DeliveryStepState = DeliveryStep & { active: boolean };

/** The steps with the reached flag a progress bar reads. */
export const deliverySteps = (status: OrderStatus): DeliveryStepState[] => {
  const currentIndex = statusStepIndex(status);

  return DELIVERY_STEPS.map((step, index) => ({
    ...step,
    active: currentIndex >= index,
  }));
};
