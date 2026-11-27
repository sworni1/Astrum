import type { ProductCartProps } from "@/common/types/product.types";

export type ReconciledSelection = {
  lines: ProductCartProps[];

  missingCount: number;
};

export const reconcileLines = (
  liveRows: ProductCartProps[],
  handedIds: string[],
): ReconciledSelection => {
  const wanted = new Set(handedIds);
  const lines = liveRows.filter((row) => wanted.has(row.id));

  return { lines, missingCount: wanted.size - lines.length };
};

export const selectionSubtotal = (lines: ProductCartProps[]): number =>
  lines.reduce((sum, line) => sum + line.price * line.quantityInCart, 0);
