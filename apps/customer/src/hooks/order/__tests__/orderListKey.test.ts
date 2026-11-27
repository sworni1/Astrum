import { describe, expect, it } from "vitest";
import { isOrderListKey, orderListKey } from "@/hooks/order/orderListKey";

describe("orderListKey", () => {
  it("отдаёт голый ключ без фильтров (AC-16)", () => {
    expect(orderListKey()).toBe("/orders");
    expect(orderListKey({})).toBe("/orders");
  });

  it("читает ALL как отсутствие фильтра (AC-16)", () => {
    expect(orderListKey({ status: "ALL" })).toBe("/orders");
  });

  it("складывает статус и запрос в строку запроса (AC-16)", () => {
    expect(orderListKey({ status: "DELIVERED" })).toBe(
      "/orders?status=DELIVERED",
    );
    expect(orderListKey({ status: "CANCELED", q: "parker" })).toBe(
      "/orders?status=CANCELED&q=parker",
    );
  });

  it("обрезает пробелы и не пускает пустой запрос в ключ (AC-16)", () => {
    expect(orderListKey({ q: "  parker  " })).toBe("/orders?q=parker");
    expect(orderListKey({ q: "   " })).toBe("/orders");
  });
});

describe("isOrderListKey", () => {
  it("совпадает с голым ключом и с любой фильтрованной формой (AC-16)", () => {
    expect(isOrderListKey("/orders")).toBe(true);
    expect(isOrderListKey("/orders?status=DELIVERED")).toBe(true);
    expect(isOrderListKey(orderListKey({ q: "pen" }))).toBe(true);
  });

  it("не совпадает с карточкой заказа и с посторонним ключом (AC-16)", () => {
    expect(isOrderListKey("/orders/order-1")).toBe(false);
    expect(isOrderListKey("/cart")).toBe(false);
    expect(isOrderListKey(undefined)).toBe(false);
  });
});
