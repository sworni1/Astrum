export type SalesColumnId =
  | "order"
  | "product"
  | "receipt"
  | "subtotal"
  | "date"
  | "status";

export type SalesColumnKey =
  | "columns.orderNumber"
  | "columns.product"
  | "columns.receipt"
  | "columns.subtotal"
  | "columns.date"
  | "columns.status";

export type SalesColumn = {
  id: SalesColumnId;
  /** The table head label. */
  headKey: SalesColumnKey;
  /** The label the stacked card prints beside the value below `sm`. */
  labelKey: SalesColumnKey;
  align: "left" | "right";
};

/**
 * The six columns of the mockup, in its own order. One list keeps the table
 * head, the stacked card labels and the tests in step (spec 0026, AC-9, AC-12).
 */
export const SALES_COLUMNS: readonly SalesColumn[] = [
  {
    id: "order",
    headKey: "columns.orderNumber",
    labelKey: "columns.orderNumber",
    align: "left",
  },
  {
    id: "product",
    headKey: "columns.product",
    labelKey: "columns.product",
    align: "left",
  },
  {
    id: "receipt",
    headKey: "columns.receipt",
    labelKey: "columns.receipt",
    align: "left",
  },
  {
    id: "subtotal",
    headKey: "columns.subtotal",
    labelKey: "columns.subtotal",
    align: "right",
  },
  {
    id: "date",
    headKey: "columns.date",
    labelKey: "columns.date",
    align: "left",
  },
  {
    id: "status",
    headKey: "columns.status",
    labelKey: "columns.status",
    align: "right",
  },
];

/** The mobile label of one column, so a cell never repeats a catalog key. */
export const columnLabel = (id: SalesColumnId): SalesColumnKey => {
  const column = SALES_COLUMNS.find((entry) => entry.id === id);

  if (column === undefined) {
    throw new Error(`Unknown sales column: ${id}`);
  }

  return column.labelKey;
};
