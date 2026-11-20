import { PaymentMethod } from "@astrum/db/enums";

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

export const HANDLED_EVENT_TYPES: readonly string[] = Object.values(
  PAYMENT_EVENT_TYPES,
);

export const isHandledEventType = (type: string): boolean =>
  HANDLED_EVENT_TYPES.includes(type);
