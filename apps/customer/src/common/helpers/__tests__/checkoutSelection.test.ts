import { beforeEach, describe, expect, it, vi } from "vitest";
import { CHECKOUT_SELECTION_KEY } from "@/common/constants/checkout";
import {
  clearCheckoutSelection,
  readCheckoutSelection,
  writeCheckoutSelection,
} from "@/common/helpers/checkoutSelection";

describe("the checkout handoff key", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("writes the ids as a JSON array and reads them back (AC-2)", () => {
    writeCheckoutSelection(["p-1", "p-2"]);

    expect(window.sessionStorage.getItem(CHECKOUT_SELECTION_KEY)).toBe(
      '["p-1","p-2"]',
    );
    expect(readCheckoutSelection()).toEqual(["p-1", "p-2"]);
  });

  it("keeps the order the cart handed over (AC-3)", () => {
    writeCheckoutSelection(["p-2", "p-1"]);

    expect(readCheckoutSelection()).toEqual(["p-2", "p-1"]);
  });

  it("reads an absent, empty or broken key as an empty selection (AC-4)", () => {
    expect(readCheckoutSelection()).toEqual([]);

    window.sessionStorage.setItem(CHECKOUT_SELECTION_KEY, "not json");
    expect(readCheckoutSelection()).toEqual([]);

    window.sessionStorage.setItem(CHECKOUT_SELECTION_KEY, '{"ids":["p-1"]}');
    expect(readCheckoutSelection()).toEqual([]);

    window.sessionStorage.setItem(CHECKOUT_SELECTION_KEY, '["p-1",7,null]');
    expect(readCheckoutSelection()).toEqual(["p-1"]);
  });

  it("survives a storage that throws on every call (AC-2)", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("SecurityError");
      });

    expect(() => writeCheckoutSelection(["p-1"])).not.toThrow();
    expect(readCheckoutSelection()).toEqual([]);

    setItem.mockRestore();
    getItem.mockRestore();
  });

  it("removes the key after a placed order (AC-7)", () => {
    writeCheckoutSelection(["p-1"]);
    clearCheckoutSelection();

    expect(window.sessionStorage.getItem(CHECKOUT_SELECTION_KEY)).toBeNull();
    expect(readCheckoutSelection()).toEqual([]);
  });
});
