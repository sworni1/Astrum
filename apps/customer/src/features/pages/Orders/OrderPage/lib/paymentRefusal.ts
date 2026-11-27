import { refusalAnswered, refusalCode } from "@/common/helpers/apiRefusal";

export type PaymentRefusalKey =
  | "notPayable"
  | "alreadyPaid"
  | "windowExpired"
  | "providerUnavailable"
  | "failed";

export type PaymentRefusal = {
  key: PaymentRefusalKey;

  revalidate: boolean;
};

const REFUSAL_KEYS: Record<string, PaymentRefusalKey> = {
  ORDER_NOT_FOUND: "failed",
  ORDER_NOT_PAYABLE: "notPayable",
  PAYMENT_ALREADY_PAID: "alreadyPaid",
  PAYMENT_WINDOW_EXPIRED: "windowExpired",
  PAYMENT_PROVIDER_UNAVAILABLE: "providerUnavailable",
};

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
