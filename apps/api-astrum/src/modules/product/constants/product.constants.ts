export const PRODUCT_ERROR_CODES = {
  notFound: "PRODUCT_NOT_FOUND",
  sellerNotAssigned: "SELLER_NOT_ASSIGNED",
  invalidCursor: "PRODUCT_INVALID_CURSOR",
  unknownCategory: "UNKNOWN_CATEGORY",
  invalidQuery: "PRODUCT_INVALID_QUERY",
} as const;

export const PRODUCT_DEFAULT_PAGE_SIZE = 8;

export const MAX_PRODUCT_QUANTITY = 2_147_483_647;

export const PRODUCT_LIST_ORDER_BY = [
  { createdAt: "desc" as const },
  { id: "desc" as const },
];

export const PUBLIC_PRODUCT_WHERE = {
  isDeleted: false,
  visibility: "Public",
  status: "Published",
} as const;
