import axios from "axios";

/**
 * The refusals about the delivery choice, each mapped to its catalog key in the
 * `cart` namespace. The form branches on the code, never on the server message
 * (spec 0009, AC-11; spec 0013, AC-6).
 */
export const CHECKOUT_ERROR_KEYS = {
  UNKNOWN_SHIPPING_METHOD: "shippingUnknown",
  SHIPPING_METHOD_INACTIVE: "shippingInactive",
  SHIPPING_CURRENCY_MISMATCH: "shippingCurrencyMismatch",
  UNKNOWN_PICKUP_POINT: "unknownPickupPoint",
  PICKUP_POINT_INACTIVE: "pickupInactive",
  PICKUP_POINT_NOT_ALLOWED: "pickupNotAllowed",
} as const;

export type CheckoutErrorCode = keyof typeof CHECKOUT_ERROR_KEYS;
export type CheckoutErrorKey = (typeof CHECKOUT_ERROR_KEYS)[CheckoutErrorCode];

/** An error that carries the machine readable code of a refused checkout. */
export class CheckoutRefusal extends Error {
  constructor(readonly code: CheckoutErrorCode) {
    super(code);
    this.name = "CheckoutRefusal";
  }
}

export const isCheckoutErrorCode = (code: string): code is CheckoutErrorCode =>
  Object.hasOwn(CHECKOUT_ERROR_KEYS, code);

export type RefusalReaction = {
  /** The catalog key of the single message the form shows. */
  key: CheckoutErrorKey;
  /** True when the method is gone, so the list is refetched and the choice cleared. */
  resetMethod: boolean;
  /** True when the point is gone or closed, so the list is refetched and cleared. */
  resetPoint: boolean;
};

/** What the form does with a refusal; undefined for any other failure (AC-6). */
export const refusalReaction = (
  error: unknown,
): RefusalReaction | undefined => {
  if (!(error instanceof CheckoutRefusal)) {
    return undefined;
  }

  const resetMethod =
    error.code === "UNKNOWN_SHIPPING_METHOD" ||
    error.code === "SHIPPING_METHOD_INACTIVE" ||
    error.code === "PICKUP_POINT_NOT_ALLOWED";
  const resetPoint =
    error.code === "UNKNOWN_PICKUP_POINT" || error.code === "PICKUP_POINT_INACTIVE";

  return {
    key: CHECKOUT_ERROR_KEYS[error.code],
    resetMethod,
    resetPoint,
  };
};

const responseCode = (error: unknown): string | undefined => {
  if (!axios.isAxiosError(error)) {
    return undefined;
  }

  const data: unknown = error.response?.data;

  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const { code } = data as { code?: unknown };

  return typeof code === "string" ? code : undefined;
};

/** A delivery method refusal, or undefined when the failure is something else. */
export const checkoutRefusalOf = (
  error: unknown,
): CheckoutRefusal | undefined => {
  const code = responseCode(error);

  return code !== undefined && isCheckoutErrorCode(code)
    ? new CheckoutRefusal(code)
    : undefined;
};
