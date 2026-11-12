/** Machine readable codes the storefront branches on. */
export const ORDER_ERROR_CODES = {
  outOfStock: "OUT_OF_STOCK",
  cartMismatch: "CART_MISMATCH",
  mixedCurrency: "MIXED_CURRENCY",
  unknownShippingMethod: "UNKNOWN_SHIPPING_METHOD",
  shippingMethodInactive: "SHIPPING_METHOD_INACTIVE",
  shippingCurrencyMismatch: "SHIPPING_CURRENCY_MISMATCH",
  validation: "VALIDATION",
  notFound: "ORDER_NOT_FOUND",
  orderItemNotFound: "ORDER_ITEM_NOT_FOUND",
  sellerNotAssigned: "SELLER_NOT_ASSIGNED",
  invalidTransition: "INVALID_STATUS_TRANSITION",
  idempotencyReused: "IDEMPOTENCY_KEY_REUSED",
  pickupPointRequired: "PICKUP_POINT_REQUIRED",
  unknownPickupPoint: "UNKNOWN_PICKUP_POINT",
  pickupPointInactive: "PICKUP_POINT_INACTIVE",
  pickupPointNotAllowed: "PICKUP_POINT_NOT_ALLOWED",
  handoverRequiresPickup: "HANDOVER_REQUIRES_PICKUP",
  nothingToHandOver: "NOTHING_TO_HAND_OVER",
} as const;

/** At most 50 lines per order (AC-7). */
export const MAX_ORDER_LINES = 50;

/** At most 999 units per line, also after repeated products are merged (AC-7). */
export const MAX_LINE_QUANTITY = 999;

/** An idempotency key is 8 to 128 characters from this alphabet (spec 0003, AC-4). */
export const IDEMPOTENCY_KEY_MIN_LENGTH = 8;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;

/** A keyed refusal re-reads the key three times, 100 ms apart (spec 0003, AC-6). */
export const REPLAY_ATTEMPTS = 3;
export const REPLAY_RETRY_DELAY_MS = 100;
