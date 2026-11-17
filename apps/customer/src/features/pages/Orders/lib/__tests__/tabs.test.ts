import { describe, expect, it } from "vitest";
import { ORDER_TABS } from "@/features/pages/Orders/lib/tabs";

describe("ORDER_TABS", () => {
  it("держит три вкладки в порядке макета и в значениях фильтра (AC-8)", () => {
    expect(ORDER_TABS.map((tab) => tab.id)).toEqual([
      "ALL",
      "DELIVERED",
      "CANCELED",
    ]);
  });

  it("берёт подпись и счётчик из своей пары ключей (AC-8)", () => {
    expect(ORDER_TABS.map((tab) => [tab.labelKey, tab.countKey])).toEqual([
      ["tabs.all", "all"],
      ["tabs.delivered", "delivered"],
      ["tabs.canceled", "canceled"],
    ]);
  });
});
