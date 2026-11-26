export const PRODUCT_ERROR_CODES = {
  notFound: "PRODUCT_NOT_FOUND",
  sellerNotAssigned: "SELLER_NOT_ASSIGNED",
} as const;

export const PRODUCT_DEFAULT_PAGE_SIZE = 8;

export const PUBLIC_PRODUCT_WHERE = {
  isDeleted: false,
  visibility: "Public",
  status: "Published",
} as const;
