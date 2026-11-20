import axios from "axios";

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

export class CheckoutRefusal extends Error {
  constructor(readonly code: CheckoutErrorCode) {
    super(code);
    this.name = "CheckoutRefusal";
  }
}

export const isCheckoutErrorCode = (code: string): code is CheckoutErrorCode =>
  Object.hasOwn(CHECKOUT_ERROR_KEYS, code);

export type RefusalReaction = {
  key: CheckoutErrorKey;

  resetMethod: boolean;

  resetPoint: boolean;
};

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

export const checkoutRefusalOf = (
  error: unknown,
): CheckoutRefusal | undefined => {
  const code = responseCode(error);

  return code !== undefined && isCheckoutErrorCode(code)
    ? new CheckoutRefusal(code)
    : undefined;
};
