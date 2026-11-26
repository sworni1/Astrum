import {
  OrderStatus,
  PaymentAttemptStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from "@astrum/db/enums";

export const PAYMENT_ERROR_CODES = {
  providerUnavailable: "PAYMENT_PROVIDER_UNAVAILABLE",
  notPayable: "ORDER_NOT_PAYABLE",
  alreadyPaid: "PAYMENT_ALREADY_PAID",
  windowExpired: "PAYMENT_WINDOW_EXPIRED",
  invalidSignature: "PAYMENT_INVALID_SIGNATURE",
} as const;

export const PAYMENT_WINDOW_MINUTES = 32;

export const PAYMENT_SWEEP_LOCK_KEY = 731015;

export const PAYMENT_SWEEP_BATCH = 20;

export const PAYMENT_SWEEP_INTERVAL_MS = 60_000;

export const PAYMENT_SESSION_RETRY_LIMIT = 1;

export const PAYMENT_PROVIDER = PaymentProvider.STRIPE;

export const PAYMENT_PRODUCT_NAME_PREFIX = "Astrum order";

export const PAYMENT_RETURN_QUERY = "?payment=return";

export const PAYMENT_CANCEL_QUERY = "?payment=cancelled";

export const PAYMENT_UNKNOWN_ERROR_CODE = "unknown";

export const PAYMENT_ERROR_MESSAGE_LIMIT = 255;

export const SESSION_STATUS_COMPLETE = "complete";

export const SESSION_STATUS_EXPIRED = "expired";

export const SESSION_STATUS_OPEN = "open";

export const SESSION_PAYMENT_STATUS_PAID = "paid";

export const STRIPE_CHECKOUT_SESSION_PREFIX = "checkout.session.";

export const STRIPE_SECRET_KEY_VARIABLE = "STRIPE_SECRET_KEY";

export const STRIPE_WEBHOOK_SECRET_VARIABLE = "STRIPE_WEBHOOK_SECRET";

export const STRIPE_WEBHOOK_BODY_OPTIONS = {
  type: "application/json",
  limit: "1mb",
} as const;

export const DEFAULT_STOREFRONT_URL = "http://localhost:3000";

export const CHOOSABLE_PAYMENT_METHODS = [
  PaymentMethod.ONLINE_CARD,
  PaymentMethod.CASH,
  PaymentMethod.CARD_ON_DELIVERY,
] as const;

export const PAYMENT_EVENT_TYPES = {
  sessionCompleted: "checkout.session.completed",
  sessionExpired: "checkout.session.expired",
  sessionAsyncFailed: "checkout.session.async_payment_failed",
  intentFailed: "payment_intent.payment_failed",
} as const;

export const HANDLED_EVENT_TYPES: readonly string[] =
  Object.values(PAYMENT_EVENT_TYPES);

export const ATTEMPT_OPEN_STATUSES: readonly PaymentAttemptStatus[] = [
  "PENDING",
  "FAILED",
];

export const PAYMENT_PAID_FROM_STATUSES: readonly PaymentStatus[] = [
  "PENDING",
  "FAILED",
  "CANCELLED",
];

export const PAYMENT_FAILED_FROM_STATUSES: readonly PaymentStatus[] = [
  "PENDING",
  "FAILED",
];

export const PAYMENT_PENDING_STATUSES: readonly PaymentStatus[] = ["PENDING"];

export const PAYMENT_SWEEP_ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
];

export const ORDER_WITH_LINES_INCLUDE = { OrderItem: true } as const;

export const ATTEMPT_WITH_ORDER_INCLUDE = {
  order: { include: { OrderItem: true } },
} as const;

export const PAYMENT_SWEEP_INCLUDE = {
  payments: {
    where: { status: { in: [...ATTEMPT_OPEN_STATUSES] } },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
};

export const PAYMENT_STATUS_SELECT = {
  paymentStatus: true,
  status: true,
  paymentExpiresAt: true,
} as const;
