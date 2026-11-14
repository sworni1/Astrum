/**
 * The five column labels of the panel, in the order the table prints them. One
 * list keeps the head and the tests that read it in step (spec 0020, AC-1).
 */
export const SELLER_COLUMNS = [
  "columns.orderNumber",
  "columns.product",
  "columns.subtotal",
  "columns.date",
  "columns.status",
] as const;

export type SellerColumnKey = (typeof SELLER_COLUMNS)[number];

/**
 * A money column reads right aligned in both the head and the cells, so the
 * label sits over the digits instead of over the whitespace beside them (AC-1).
 */
export const SELLER_COLUMN_ALIGNMENT: Partial<Record<SellerColumnKey, string>> =
  {
    "columns.subtotal": "text-right",
  };
