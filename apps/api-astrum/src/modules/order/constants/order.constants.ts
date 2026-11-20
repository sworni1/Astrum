import type {
  OrderItemStatus,
  PaymentMethod,
} from "@astrum/db/enums";

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
  nothingToHandOver: "NOTHING_TO_HAND_OVER",
  sellerPanelReadOnly: "SELLER_PANEL_READ_ONLY",
  invalidStatusFilter: "INVALID_STATUS_FILTER",
  searchQueryTooLong: "SEARCH_QUERY_TOO_LONG",
} as const;

export const ORDER_LIST_STATUSES = ["ALL", "DELIVERED", "CANCELED"] as const;

export type OrderListStatus = (typeof ORDER_LIST_STATUSES)[number];

export const ORDER_LIST_STATUS_FILTERS = ORDER_LIST_STATUSES.filter(
  (value): value is Exclude<OrderListStatus, "ALL"> => value !== "ALL",
);

export const ORDER_SEARCH_MAX_LENGTH = 64;

export const LINE_STATUS_BY_PAYMENT_METHOD: Record<
  PaymentMethod,
  OrderItemStatus
> = {
  CASH: "CONFIRMED",
  CARD_ON_DELIVERY: "CONFIRMED",
  ONLINE_CARD: "PENDING",
  PAYPAL: "PENDING",
  STRIPE: "PENDING",
};

export const MAX_ORDER_LINES = 50;

export const MAX_LINE_QUANTITY = 999;

export const IDEMPOTENCY_KEY_MIN_LENGTH = 8;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;

export const REPLAY_ATTEMPTS = 3;
export const REPLAY_RETRY_DELAY_MS = 100;

export const ORDER_SHIPPING_DELAY_MS = 60_000;

export const ORDER_SHIPPING_INTERVAL_MS = 60_000;

export const ORDER_SHIPPING_BATCH = 20;
