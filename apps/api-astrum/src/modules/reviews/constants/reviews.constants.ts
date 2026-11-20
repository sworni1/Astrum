export const REVIEW_ERROR_CODES = {
  notFound: "REVIEW_NOT_FOUND",
  orderItemNotFound: "REVIEW_ORDER_ITEM_NOT_FOUND",
  productMismatch: "REVIEW_PRODUCT_MISMATCH",
  onlyAfterDelivery: "REVIEW_ONLY_AFTER_DELIVERY",
  alreadyExists: "REVIEW_ALREADY_EXISTS",
  invalidPagination: "REVIEW_INVALID_PAGINATION",
  invalidCursor: "REVIEW_INVALID_CURSOR",
  commentNotFound: "REVIEW_COMMENT_NOT_FOUND",
  commentForbidden: "REVIEW_COMMENT_FORBIDDEN",
  commentRateLimited: "REVIEW_COMMENT_RATE_LIMITED",
} as const;

export const REVIEW_PAGE_DEFAULT_LIMIT = 20;
export const REVIEW_PAGE_MAX_LIMIT = 50;

export const REVIEW_COMMENT_PAGE_DEFAULT_LIMIT = 10;

export const REVIEW_COMMENT_MIN_LENGTH = 5;
export const REVIEW_COMMENT_MAX_LENGTH = 2000;

export const REVIEW_COMMENT_RATE_LIMIT = 10;
export const REVIEW_COMMENT_RATE_WINDOW_MS = 60 * 60 * 1000;
