import type {
  OrderListPage,
  OrderListStatus,
} from "@/common/types/order.types";

export type OrderTab = {
  id: OrderListStatus;
  labelKey: "tabs.all" | "tabs.delivered" | "tabs.canceled";
  countKey: "all" | "delivered" | "canceled";
};

/**
 * The three tabs in the mockup order. `ALL` sends no status at all, so the first
 * request key is the bare `/orders` (spec 0025, AC-8). Row 15 of the scope
 * copies this grouping instead of inventing a second meaning of "delivered".
 */
export const ORDER_TABS: readonly OrderTab[] = [
  { id: "ALL", labelKey: "tabs.all", countKey: "all" },
  { id: "DELIVERED", labelKey: "tabs.delivered", countKey: "delivered" },
  { id: "CANCELED", labelKey: "tabs.canceled", countKey: "canceled" },
];

/** The count of one chosen tab, which decides the "this tab is empty" state. */
export const countForStatus = (
  counts: OrderListPage["counts"],
  status: OrderListStatus,
): number => {
  const tab = ORDER_TABS.find((entry) => entry.id === status);

  return tab === undefined ? 0 : counts[tab.countKey];
};
