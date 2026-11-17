/**
 * The class names of the table geometry in spec 0026 that more than one file
 * needs: the card, the head, a row, a cell and the pieces inside a cell. One
 * place per value, the same way `Orders/lib/styles.ts` holds its card geometry.
 */
export const TABLE_CARD = "overflow-hidden rounded-xl border border-border bg-card";

export const HEAD_CELL =
  "border-b border-border px-4 py-3 text-[13px] font-medium text-muted-foreground";

export const ROW = "block border-b border-border last:border-b-0 sm:table-row";

export const CELL =
  "flex items-baseline justify-between gap-3 px-4 py-3 sm:table-cell sm:px-4 sm:py-[14px] sm:text-sm";

export const CELL_LABEL = "text-xs text-muted-foreground sm:hidden";

export const ORDER_NUMBER = "font-mono text-[13px]";

export const PRODUCT_NAME = "font-medium hover:underline";

export const QUANTITY = "text-[12.5px] text-muted-foreground";

export const THUMB =
  "grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-secondary";

export const AMOUNT = "font-medium tabular-nums";

export const BADGE =
  "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[12.5px] font-medium";
