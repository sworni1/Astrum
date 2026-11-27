import Stripe from "stripe";
import { STRIPE_CHECKOUT_SESSION_PREFIX } from "../constants/payment.constants";
import type { ProviderEvent, ProviderSession } from "../types/payment.types";

export const isIdempotencyRefusal = (error: unknown): boolean =>
  error instanceof Stripe.errors.StripeIdempotencyError ||
  (typeof error === "object" &&
    error !== null &&
    (error as { type?: unknown }).type === "StripeIdempotencyError");

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const asText = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" ? value : null;

const readOrderId = (record: Record<string, unknown>): string | null =>
  asText(asRecord(record.metadata).order_id);

const toPaymentIntentId = (value: unknown): string | null => {
  if (typeof value === "string") {
    return asText(value);
  }

  return asText(asRecord(value).id);
};

export const toProviderSession = (value: unknown): ProviderSession => {
  const record = asRecord(value);

  return {
    id: String(record.id ?? ""),
    status: asText(record.status),
    paymentStatus: asText(record.payment_status),
    amountTotal: asNumber(record.amount_total),
    currency: asText(record.currency),
    paymentIntentId: toPaymentIntentId(record.payment_intent),
    orderId: readOrderId(record),
  };
};

export const toProviderEvent = (value: unknown): ProviderEvent => {
  const event = asRecord(value);
  const object = asRecord(event.data && asRecord(event.data).object);
  const isSession = String(event.type ?? "").startsWith(
    STRIPE_CHECKOUT_SESSION_PREFIX,
  );

  return {
    id: String(event.id ?? ""),
    type: String(event.type ?? ""),
    sessionId: isSession ? asText(object.id) : asText(object.checkout_session),
    paymentIntentId: isSession
      ? toPaymentIntentId(object.payment_intent)
      : asText(object.id),
    orderId: readOrderId(object),
    amount: isSession ? asNumber(object.amount_total) : asNumber(object.amount),
    currency: asText(object.currency),
    sessionStatus: isSession ? asText(object.status) : null,
    paymentStatus: isSession
      ? asText(object.payment_status)
      : asText(object.status),
    declineCode:
      asText(asRecord(object.last_payment_error).decline_code) ??
      asText(asRecord(object.last_payment_error).code),
    errorMessage: asText(asRecord(object.last_payment_error).message),
  };
};
