/** Which of the three empty states applies, or none of them. */
export type SalesEmptyState = "none" | "noLines" | "noResults" | "emptyTab";

export type SalesEmptyInput = {
  itemCount: number;
  allCount: number;
  tabCount: number;
  query: string;
  isValidating: boolean;
};

/**
 * The precedence is fixed: a read in flight claims nothing, then "no lines at
 * all" over the whole set (never the filtered `total`), then "nothing found",
 * then "this tab is empty". Every gate reads the settled query, never the raw
 * input (spec 0026, AC-11).
 */
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

/** The copy of each state; the "no lines at all" pair is reused, not duplicated. */
export const SALES_EMPTY_COPY: Record<
  Exclude<SalesEmptyState, "none">,
  SalesEmptyCopy
> = {
  noLines: { titleKey: "states.emptyTitle", textKey: "states.emptyText" },
  noResults: { titleKey: "emptySearchTitle", textKey: "emptySearchText" },
  emptyTab: { titleKey: "emptyTabTitle", textKey: "emptyTabText" },
};
