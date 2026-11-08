import { describe, expect, it } from "vitest";
import { OrderItemStatus } from "../types/order.types";
import { ITEM_STATUS_KEYS, itemStatusKey } from "./itemStatus";

describe("itemStatusKey", () => {
  it("maps all nine line statuses to one catalog key (AC-4)", () => {
    expect(Object.values(OrderItemStatus)).toHaveLength(9);

    for (const status of Object.values(OrderItemStatus)) {
      expect(itemStatusKey(status)).toBe(ITEM_STATUS_KEYS[status]);
      expect(itemStatusKey(status)).toBeTypeOf("string");
    }
  });

  it("leaves an unknown status to the raw value (AC-6)", () => {
    expect(itemStatusKey("SOMETHING_NEW")).toBeUndefined();
  });
});
