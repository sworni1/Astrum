import type {
  OrderListPage,
  OrderListStatus,
} from "@/common/types/order.types";

export type OrderTab = {
  id: OrderListStatus;
  labelKey: "tabs.all" | "tabs.delivered" | "tabs.canceled";
  countKey: "all" | "delivered" | "canceled";
};

export const ORDER_TABS: readonly OrderTab[] = [
  { id: "ALL", labelKey: "tabs.all", countKey: "all" },
  { id: "DELIVERED", labelKey: "tabs.delivered", countKey: "delivered" },
  { id: "CANCELED", labelKey: "tabs.canceled", countKey: "canceled" },
];

export const countForStatus = (
  counts: OrderListPage["counts"],
  status: OrderListStatus,
): number => {
  const tab = ORDER_TABS.find((entry) => entry.id === status);

  return tab === undefined ? 0 : counts[tab.countKey];
};
