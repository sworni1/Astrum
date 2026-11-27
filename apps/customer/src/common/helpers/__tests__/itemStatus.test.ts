import { describe, expect, it } from "vitest";
import { ITEM_STATUS_KEYS, itemStatusKey } from "@/common/helpers/itemStatus";
import { OrderItemStatus } from "@/common/types/order.types";

describe("itemStatusKey", () => {
  it("maps all ten line statuses to one catalog key (AC-4, spec 0031 AC-7)", () => {
    expect(Object.values(OrderItemStatus)).toHaveLength(10);

    for (const status of Object.values(OrderItemStatus)) {
      expect(itemStatusKey(status)).toBe(ITEM_STATUS_KEYS[status]);
      expect(itemStatusKey(status)).toBeTypeOf("string");
    }
  });

  it("leaves an unknown status to the raw value (AC-6)", () => {
    expect(itemStatusKey("SOMETHING_NEW")).toBeUndefined();
  });
});
