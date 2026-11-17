import type { ProductCartProps } from "@/common/types/product.types";

export type ReconciledSelection = {
  /** The live rows the customer ticked, in the order the cart read carries. */
  lines: ProductCartProps[];
  /** How many handed over ids are no longer in the live cart. */
  missingCount: number;
};

/**
 * Keeps only the rows the live cart still holds, in the answer's own order, so
 * no value and no ordering ever comes from the handoff (spec 0024, AC-3) and a
 * partly stale selection is countable (AC-5).
 */
export const reconcileLines = (
  liveRows: ProductCartProps[],
  handedIds: string[],
): ReconciledSelection => {
  const wanted = new Set(handedIds);
  const lines = liveRows.filter((row) => wanted.has(row.id));

  return { lines, missingCount: wanted.size - lines.length };
};

/** The sum of the kept rows, on numbers only; printing stays with `formatMoney`. */
export const selectionSubtotal = (lines: ProductCartProps[]): number =>
  lines.reduce((sum, line) => sum + line.price * line.quantityInCart, 0);
