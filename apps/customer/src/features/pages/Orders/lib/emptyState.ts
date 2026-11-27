export type OrdersEmptyState = "none" | "noOrders" | "noResults" | "emptyTab";

export type OrdersEmptyInput = {
  itemCount: number;
  allCount: number;
  tabCount: number;
  query: string;
  isValidating: boolean;
};

export const ordersEmptyState = ({
  itemCount,
  allCount,
  tabCount,
  query,
  isValidating,
}: OrdersEmptyInput): OrdersEmptyState => {
  if (isValidating || itemCount > 0) {
    return "none";
  }

  if (allCount === 0) {
    return "noOrders";
  }

  if (query !== "") {
    return "noResults";
  }

  return tabCount === 0 ? "emptyTab" : "none";
};

export type OrdersEmptyCopy = {
  titleKey: "emptyTitle" | "emptySearchTitle" | "emptyTabTitle";
  textKey: "emptyText" | "emptySearchText" | "emptyTabText";
};

export const EMPTY_COPY: Record<
  Exclude<OrdersEmptyState, "none">,
  OrdersEmptyCopy
> = {
  noOrders: { titleKey: "emptyTitle", textKey: "emptyText" },
  noResults: { titleKey: "emptySearchTitle", textKey: "emptySearchText" },
  emptyTab: { titleKey: "emptyTabTitle", textKey: "emptyTabText" },
};
