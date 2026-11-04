/** Machine readable codes the storefront branches on. */
export const ORDER_ERROR_CODES = {
  outOfStock: "OUT_OF_STOCK",
  cartMismatch: "CART_MISMATCH",
  mixedCurrency: "MIXED_CURRENCY",
  unknownShippingMethod: "UNKNOWN_SHIPPING_METHOD",
  validation: "VALIDATION",
  notFound: "ORDER_NOT_FOUND",
  invalidTransition: "INVALID_STATUS_TRANSITION",
} as const;

/** At most 50 lines per order (AC-7). */
export const MAX_ORDER_LINES = 50;

/** At most 999 units per line, also after repeated products are merged (AC-7). */
export const MAX_LINE_QUANTITY = 999;
