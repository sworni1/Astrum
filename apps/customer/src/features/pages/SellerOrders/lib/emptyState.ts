export type SalesEmptyState = "none" | "noLines" | "noResults" | "emptyTab";

export type SalesEmptyInput = {
  itemCount: number;
  allCount: number;
  tabCount: number;
  query: string;
  isValidating: boolean;
};

export const salesEmptyState = ({
  itemCount,
  allCount,
  tabCount,
  query,
  isValidating,
}: SalesEmptyInput): SalesEmptyState => {
  if (isValidating || itemCount > 0) {
    return "none";
  }

  if (allCount === 0) {
    return "noLines";
  }

  if (query !== "") {
    return "noResults";
  }

  return tabCount === 0 ? "emptyTab" : "none";
};

export type SalesEmptyCopy = {
  titleKey: "states.emptyTitle" | "emptySearchTitle" | "emptyTabTitle";
  textKey: "states.emptyText" | "emptySearchText" | "emptyTabText";
};

export const SALES_EMPTY_COPY: Record<
  Exclude<SalesEmptyState, "none">,
  SalesEmptyCopy
> = {
  noLines: { titleKey: "states.emptyTitle", textKey: "states.emptyText" },
  noResults: { titleKey: "emptySearchTitle", textKey: "emptySearchText" },
  emptyTab: { titleKey: "emptyTabTitle", textKey: "emptyTabText" },
};
