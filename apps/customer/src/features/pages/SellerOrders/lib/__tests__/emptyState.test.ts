import { describe, expect, it } from "vitest";
import { salesEmptyState } from "@/features/pages/SellerOrders/lib/emptyState";

const base = {
  itemCount: 0,
  allCount: 5,
  tabCount: 2,
  query: "",
  isValidating: false,
};

describe("salesEmptyState", () => {
  it("claims nothing while a read is in flight (AC-11)", () => {
    expect(salesEmptyState({ ...base, allCount: 0, isValidating: true })).toBe(
      "none",
    );
  });

  it("claims nothing while the page holds lines (AC-11)", () => {
    expect(salesEmptyState({ ...base, itemCount: 1 })).toBe("none");
  });

  it("reads the whole set, never the filtered total, for no lines at all (AC-11)", () => {
    expect(salesEmptyState({ ...base, allCount: 0, tabCount: 0 })).toBe(
      "noLines",
    );
  });

  it("prefers the searched verdict over the empty tab one (AC-11)", () => {
    expect(salesEmptyState({ ...base, query: "drill", tabCount: 0 })).toBe(
      "noResults",
    );
  });

  it("ends on the empty tab only when the tab holds nothing (AC-11)", () => {
    expect(salesEmptyState({ ...base, tabCount: 0 })).toBe("emptyTab");
    expect(salesEmptyState({ ...base, tabCount: 1 })).toBe("none");
  });
});
