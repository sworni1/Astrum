import { describe, expect, it } from "vitest";
import { ordersEmptyState } from "@/features/pages/Orders/lib/emptyState";

const input = {
  itemCount: 0,
  allCount: 3,
  tabCount: 0,
  query: "",
  isValidating: false,
};

describe("ordersEmptyState", () => {
  it("не показывает пустое состояние поверх списка (AC-12)", () => {
    expect(ordersEmptyState({ ...input, itemCount: 2 })).toBe("none");
  });

  it("говорит «заказов нет», когда набор покупателя пуст (AC-12)", () => {
    expect(ordersEmptyState({ ...input, allCount: 0 })).toBe("noOrders");
  });

  it("говорит «ничего не найдено» на непустой запрос (AC-12)", () => {
    expect(ordersEmptyState({ ...input, query: "parker" })).toBe("noResults");
  });

  it("говорит «в этой вкладке пусто», когда счётчик вкладки ноль (AC-12)", () => {
    expect(ordersEmptyState(input)).toBe("emptyTab");
  });

  it("не выносит вердикт, пока запрос в пути (AC-12)", () => {
    expect(ordersEmptyState({ ...input, isValidating: true })).toBe("none");
    expect(
      ordersEmptyState({ ...input, query: "parker", isValidating: true }),
    ).toBe("none");
  });

  it("держится порядка: нет заказов раньше, чем пустая вкладка (AC-12)", () => {
    expect(ordersEmptyState({ ...input, allCount: 0, tabCount: 0 })).toBe(
      "noOrders",
    );
  });
});
