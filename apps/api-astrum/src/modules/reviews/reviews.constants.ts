/** Machine readable codes the storefront branches on. */
export const REVIEW_ERROR_CODES = {
  notFound: "REVIEW_NOT_FOUND",
  orderItemNotFound: "REVIEW_ORDER_ITEM_NOT_FOUND",
  productMismatch: "REVIEW_PRODUCT_MISMATCH",
  onlyAfterDelivery: "REVIEW_ONLY_AFTER_DELIVERY",
  alreadyExists: "REVIEW_ALREADY_EXISTS",
  invalidPagination: "REVIEW_INVALID_PAGINATION",
  invalidCursor: "REVIEW_INVALID_CURSOR",
} as const;

/** The list defaults to 20 rows and never answers more than 50 (AC-12). */
export const REVIEW_PAGE_DEFAULT_LIMIT = 20;
export const REVIEW_PAGE_MAX_LIMIT = 50;

/** A comment holds 5 to 2000 UTF-16 units after the trim (AC-8, AC-11). */
export const REVIEW_COMMENT_MIN_LENGTH = 5;
export const REVIEW_COMMENT_MAX_LENGTH = 2000;
