import { Check, type LucideIcon, Package, Truck } from "lucide-react";
import { OrderStatus } from "@/common/types/order.types";

export type PillTone = "success" | "destructive" | "neutral";

export type StatusLabelKey =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "issued"
  | "canceled";

export const STATUS_KEYS: Record<OrderStatus, StatusLabelKey> = {
  [OrderStatus.PENDING]: "pending",
  [OrderStatus.CONFIRMED]: "confirmed",
  [OrderStatus.SHIPPED]: "shipped",
  [OrderStatus.DELIVERED]: "delivered",
  [OrderStatus.ISSUED]: "issued",
  [OrderStatus.CANCELED]: "canceled",
};

const CANCELLABLE_STATUSES: readonly OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
];

export const canCancel = (status: OrderStatus): boolean =>
  CANCELLABLE_STATUSES.includes(status);

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

export const statusStepIndex: Record<OrderStatus, number> = {
  [OrderStatus.PENDING]: -1,
  [OrderStatus.CONFIRMED]: 0,
  [OrderStatus.SHIPPED]: 1,
  [OrderStatus.DELIVERED]: 2,
  [OrderStatus.ISSUED]: 3,
  [OrderStatus.CANCELED]: -1,
};

export type DeliveryStepState = DeliveryStep & { active: boolean };

export const deliverySteps = (status: OrderStatus): DeliveryStepState[] => {
  const currentIndex = statusStepIndex[status] ?? -1;

  return DELIVERY_STEPS.map((step, index) => ({
    ...step,
    active: currentIndex >= index,
  }));
};
