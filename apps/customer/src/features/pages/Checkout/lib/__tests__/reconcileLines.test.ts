import { describe, expect, it } from "vitest";
import type { ProductCartProps } from "@/common/types/product.types";
import {
  reconcileLines,
  selectionSubtotal,
} from "@/features/pages/Checkout/lib/reconcileLines";

const row = (id: string, price: number, quantityInCart: number) =>
  ({ id, name: id, price, quantityInCart }) as ProductCartProps;

describe("reconcileLines", () => {
  it("keeps the handed rows in the order the live cart carries them (AC-3)", () => {
    const live = [row("p-1", 10, 1), row("p-2", 20, 2), row("p-3", 30, 1)];

    const result = reconcileLines(live, ["p-3", "p-1"]);

    expect(result.lines.map((line) => line.id)).toEqual(["p-1", "p-3"]);
    expect(result.missingCount).toBe(0);
  });

  it("counts the handed ids the live cart no longer holds (AC-5)", () => {
    const live = [row("p-1", 10, 1)];

    const result = reconcileLines(live, ["p-1", "p-gone"]);

    expect(result.lines.map((line) => line.id)).toEqual(["p-1"]);
    expect(result.missingCount).toBe(1);
  });

  it("returns nothing when no handed id is in the live cart (AC-4)", () => {
    const result = reconcileLines([row("p-1", 10, 1)], ["p-gone"]);

    expect(result.lines).toEqual([]);
    expect(result.missingCount).toBe(1);
  });

  it("reads an empty handoff as an empty selection (AC-4)", () => {
    expect(reconcileLines([row("p-1", 10, 1)], [])).toEqual({
      lines: [],
      missingCount: 0,
    });
  });

  it("ignores a repeated id in the handoff (AC-3)", () => {
    const result = reconcileLines([row("p-1", 10, 1)], ["p-1", "p-1"]);

    expect(result.lines).toHaveLength(1);
    expect(result.missingCount).toBe(0);
  });
});

describe("selectionSubtotal", () => {
  it("sums price times quantity over the kept rows (AC-3)", () => {
    expect(selectionSubtotal([row("p-1", 56, 2), row("p-2", 100, 1)])).toBe(
      212,
    );
  });

  it("reads an empty selection as zero (AC-3)", () => {
    expect(selectionSubtotal([])).toBe(0);
  });
});
