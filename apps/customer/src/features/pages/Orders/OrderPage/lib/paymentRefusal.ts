import { refusalAnswered, refusalCode } from "@/common/helpers/apiRefusal";

/** The catalog keys under `orders.payment` that answer a refused pay request. */
export type PaymentRefusalKey =
  | "notPayable"
  | "alreadyPaid"
  | "windowExpired"
  | "providerUnavailable"
  | "failed";

export type PaymentRefusal = {
  key: PaymentRefusalKey;
  /** True when the screen must re read the order before showing the message. */
  revalidate: boolean;
};

/** Every code the pay route can answer, in one table (AC-13, AC-15). */
const REFUSAL_KEYS: Record<string, PaymentRefusalKey> = {
  ORDER_NOT_FOUND: "failed",
  ORDER_NOT_PAYABLE: "notPayable",
  PAYMENT_ALREADY_PAID: "alreadyPaid",
  PAYMENT_WINDOW_EXPIRED: "windowExpired",
  PAYMENT_PROVIDER_UNAVAILABLE: "providerUnavailable",
};

/**
 * The global fetcher interceptor reads a code on `401` and `403` only, so these
 * branches come through `apiRefusal`, which reads one on any status. A request
 * that got no answer at all is not a refusal and answers the generic copy.
 */
export const paymentRefusal = (error: unknown): PaymentRefusal => {
  if (!refusalAnswered(error)) {
    return { key: "failed", revalidate: false };
  }

  const code = refusalCode(error);
  const key = code === undefined ? undefined : REFUSAL_KEYS[code];

  return {
    key: key ?? "failed",
    revalidate: key === "windowExpired",
  };
};
