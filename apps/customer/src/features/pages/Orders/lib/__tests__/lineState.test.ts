import { describe, expect, it } from "vitest";
import { OrderItemStatus } from "@/common/types/order.types";
import { LINE_STATES, lineStateOf } from "@/features/pages/Orders/lib/lineState";

describe("lineStateOf", () => {
  it("знает все девять статусов позиции (AC-11)", () => {
    const members = Object.values(OrderItemStatus).sort();
    const keyed = Object.keys(LINE_STATES).sort();

    expect(keyed).toEqual(members);
  });

  it("красит полученную позицию зелёным, отменённую красным, остальные серым (AC-11)", () => {
    expect(lineStateOf(OrderItemStatus.DELIVERED).dot).toBe("bg-success");
    expect(lineStateOf(OrderItemStatus.CANCELLED).dot).toBe("bg-destructive-soft");

    for (const status of [
      OrderItemStatus.PENDING,
      OrderItemStatus.CONFIRMED,
      OrderItemStatus.OUT_OF_STOCK,
      OrderItemStatus.SHIPPED,
      OrderItemStatus.RETURNED,
      OrderItemStatus.BACKORDERED,
      OrderItemStatus.REPLACED,
    ]) {
      expect(lineStateOf(status).dot).toBe("bg-muted-foreground");
    }
  });

  it("даёт каждой позиции свой ключ подписи (AC-11)", () => {
    expect(lineStateOf(OrderItemStatus.OUT_OF_STOCK).labelKey).toBe(
      "itemStatus.outOfStock",
    );
    expect(lineStateOf(OrderItemStatus.CANCELLED).labelKey).toBe(
      "itemStatus.cancelled",
    );
  });
});
