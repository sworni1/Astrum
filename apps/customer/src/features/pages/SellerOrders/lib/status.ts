import {
  OrderItemStatus,
  type SellerLineCounts,
  type SellerListStatus,
} from "@/common/types/order.types";

export type BadgeTone = "success" | "destructive" | "secondary";

export const BADGE_TONE: Record<OrderItemStatus, BadgeTone> = {
  [OrderItemStatus.DELIVERED]: "secondary",
  [OrderItemStatus.ISSUED]: "success",
  [OrderItemStatus.CANCELLED]: "destructive",
  [OrderItemStatus.OUT_OF_STOCK]: "destructive",
  [OrderItemStatus.PENDING]: "secondary",
  [OrderItemStatus.CONFIRMED]: "secondary",
  [OrderItemStatus.SHIPPED]: "secondary",
  [OrderItemStatus.RETURNED]: "secondary",
  [OrderItemStatus.BACKORDERED]: "secondary",
  [OrderItemStatus.REPLACED]: "secondary",
};

export const badgeToneOf = (status: string): BadgeTone =>
  BADGE_TONE[status as OrderItemStatus] ?? "secondary";

export const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  success: "border-success/20 bg-success/10 text-success",
  destructive:
    "border-destructive-soft/20 bg-destructive-soft/10 text-destructive-soft",
  secondary: "border-border bg-secondary text-foreground",
};

export type SellerTab = {
  id: SellerListStatus;
  labelKey: "tabs.all" | "tabs.delivered" | "tabs.canceled";
  countKey: keyof SellerLineCounts;
};

export const SELLER_TABS: readonly SellerTab[] = [
  { id: "ALL", labelKey: "tabs.all", countKey: "all" },
  { id: "DELIVERED", labelKey: "tabs.delivered", countKey: "delivered" },
  { id: "CANCELED", labelKey: "tabs.canceled", countKey: "canceled" },
];

export const countForStatus = (
  counts: SellerLineCounts,
  status: SellerListStatus,
): number => {
  const tab = SELLER_TABS.find((entry) => entry.id === status);

  return tab === undefined ? 0 : counts[tab.countKey];
};
