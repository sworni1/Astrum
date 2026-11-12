import { PaymentMethod } from "../../../generated/prisma/enums";

/** Machine readable codes the storefront branches on (spec 0015, AC-4, AC-10). */
export const PAYMENT_ERROR_CODES = {
  providerUnavailable: "PAYMENT_PROVIDER_UNAVAILABLE",
  notPayable: "ORDER_NOT_PAYABLE",
  alreadyPaid: "PAYMENT_ALREADY_PAID",
  windowExpired: "PAYMENT_WINDOW_EXPIRED",
  invalidSignature: "PAYMENT_INVALID_SIGNATURE",
} as const;

/**
 * The payment window a created order holds its stock for: the provider floor of
 * 30 minutes plus a safety margin (spec 0015, AC-2).
 */
export const PAYMENT_WINDOW_MINUTES = 32;

/** The advisory lock the reconciliation pass takes, so one replica sweeps (AC-9). */
export const PAYMENT_SWEEP_LOCK_KEY = 731015;

/** Bounded work per pass, ordered by the deadline that passed longest ago (AC-9). */
export const PAYMENT_SWEEP_BATCH = 20;

export const PAYMENT_SWEEP_INTERVAL_MS = 60_000;

/**
 * The methods a customer may choose on a new order. The enum keeps all five,
 * because old orders still print the two that are no longer selectable (AC-3).
 */
export const CHOOSABLE_PAYMENT_METHODS = [
  PaymentMethod.ONLINE_CARD,
  PaymentMethod.CASH,
  PaymentMethod.CARD_ON_DELIVERY,
] as const;

/** The four callbacks this feature acts on; every other type writes nothing (AC-5). */
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
