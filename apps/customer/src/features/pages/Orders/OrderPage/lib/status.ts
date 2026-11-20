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
  | "issued"
  | "canceled";

/** One status to catalog key table, so a label is written once. */
export const STATUS_KEYS: Record<OrderStatus, StatusLabelKey> = {
  [OrderStatus.PENDING]: "pending",
  [OrderStatus.CONFIRMED]: "confirmed",
  [OrderStatus.SHIPPED]: "shipped",
  [OrderStatus.DELIVERED]: "delivered",
  [OrderStatus.ISSUED]: "issued",
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
 * The pill tone of every order status: a parcel the buyer holds reads success,
 * one that only arrived stays neutral, a canceled order reads destructive, and
 * the steps in between stay neutral too, so no status lands without a tone
 * (spec 0027, AC-8; spec 0031, AC-7).
 */
export const STATUS_TONES: Record<OrderStatus, PillTone> = {
  [OrderStatus.PENDING]: "neutral",
  [OrderStatus.CONFIRMED]: "neutral",
  [OrderStatus.SHIPPED]: "neutral",
  [OrderStatus.DELIVERED]: "neutral",
  [OrderStatus.ISSUED]: "success",
  [OrderStatus.CANCELED]: "destructive",
};

export type DeliveryStep = {
  status: OrderStatus;
  key: StatusLabelKey;
  icon: LucideIcon;
};

/** The four steps a parcel walks, in order. A cancelled order shows none of them. */
export const DELIVERY_STEPS: readonly DeliveryStep[] = [
  { status: OrderStatus.CONFIRMED, key: "confirmed", icon: Check },
  { status: OrderStatus.SHIPPED, key: "shipped", icon: Package },
  { status: OrderStatus.DELIVERED, key: "delivered", icon: Truck },
  { status: OrderStatus.ISSUED, key: "issued", icon: Check },
];

export const DELIVERY_PROGRESS: Record<OrderStatus, number> = {
  [OrderStatus.PENDING]: 0,
  [OrderStatus.CONFIRMED]: 25,
  [OrderStatus.SHIPPED]: 50,
  [OrderStatus.DELIVERED]: 75,
  [OrderStatus.ISSUED]: 100,
  [OrderStatus.CANCELED]: 0,
};

/**
 * How far the parcel got: -1 means no step is reached, which a cancelled order
 * and a still unconfirmed one carry. The rail starts at the confirmed step, so
 * the pending status has no label of its own (spec 0031, AC-7).
 * The table names every member, so a status added later is a type error instead
 * of a silent -1.
 */
export const statusStepIndex: Record<OrderStatus, number> = {
  [OrderStatus.PENDING]: -1,
  [OrderStatus.CONFIRMED]: 0,
  [OrderStatus.SHIPPED]: 1,
  [OrderStatus.DELIVERED]: 2,
  [OrderStatus.ISSUED]: 3,
  [OrderStatus.CANCELED]: -1,
};

export type DeliveryStepState = DeliveryStep & { active: boolean };

/** The steps with the reached flag a progress bar reads. */
export const deliverySteps = (status: OrderStatus): DeliveryStepState[] => {
  const currentIndex = statusStepIndex[status] ?? -1;

  return DELIVERY_STEPS.map((step, index) => ({
    ...step,
    active: currentIndex >= index,
  }));
};
