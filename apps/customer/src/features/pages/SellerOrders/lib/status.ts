import {
  OrderItemStatus,
  type SellerLineCounts,
  type SellerListStatus,
} from "@/common/types/order.types";

export type BadgeTone = "success" | "destructive" | "secondary";

/**
 * One tone per line status, never a boolean test: delivered reads as good, the
 * two lost sales as canceled, and the rest wait in a neutral badge (spec 0026,
 * AC-9). The `Record` forces a decision for every member added later.
 */
export const BADGE_TONE: Record<OrderItemStatus, BadgeTone> = {
  [OrderItemStatus.DELIVERED]: "success",
  [OrderItemStatus.CANCELLED]: "destructive",
  [OrderItemStatus.OUT_OF_STOCK]: "destructive",
  [OrderItemStatus.PENDING]: "secondary",
  [OrderItemStatus.CONFIRMED]: "secondary",
  [OrderItemStatus.SHIPPED]: "secondary",
  [OrderItemStatus.RETURNED]: "secondary",
  [OrderItemStatus.BACKORDERED]: "secondary",
  [OrderItemStatus.REPLACED]: "secondary",
};

/** A status the table does not know keeps the neutral tone and its raw label. */
export const badgeToneOf = (status: string): BadgeTone =>
  BADGE_TONE[status as OrderItemStatus] ?? "secondary";

/** The pill of a badge, one class per tone, every colour a theme token (AC-12). */
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

/**
 * The three tabs in the mockup order. `ALL` sends no status at all, and the two
 * buckets are the same pair the read filters by, so a tab and its tile cannot
 * disagree (spec 0026, AC-4, AC-7).
 */
export const SELLER_TABS: readonly SellerTab[] = [
  { id: "ALL", labelKey: "tabs.all", countKey: "all" },
  { id: "DELIVERED", labelKey: "tabs.delivered", countKey: "delivered" },
  { id: "CANCELED", labelKey: "tabs.canceled", countKey: "canceled" },
];

/** The count of one chosen tab, which decides the "this tab is empty" state. */
export const countForStatus = (
  counts: SellerLineCounts,
  status: SellerListStatus,
): number => {
  const tab = SELLER_TABS.find((entry) => entry.id === status);

  return tab === undefined ? 0 : counts[tab.countKey];
};
