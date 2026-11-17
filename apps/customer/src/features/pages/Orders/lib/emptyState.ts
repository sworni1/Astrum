/** Which of the three empty states applies, or none of them. */
export type OrdersEmptyState = "none" | "noOrders" | "noResults" | "emptyTab";

export type OrdersEmptyInput = {
  itemCount: number;
  allCount: number;
  tabCount: number;
  query: string;
  isValidating: boolean;
};

/**
 * The precedence is fixed: a read in flight claims nothing, then "no orders at
 * all", then "nothing found", then "this tab is empty". Every gate reads the
 * settled query, never the raw input (spec 0025, AC-12).
 */
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

/** The copy of each state; the "no orders at all" pair is reused, not duplicated. */
export const EMPTY_COPY: Record<
  Exclude<OrdersEmptyState, "none">,
  OrdersEmptyCopy
> = {
  noOrders: { titleKey: "emptyTitle", textKey: "emptyText" },
  noResults: { titleKey: "emptySearchTitle", textKey: "emptySearchText" },
  emptyTab: { titleKey: "emptyTabTitle", textKey: "emptyTabText" },
};
