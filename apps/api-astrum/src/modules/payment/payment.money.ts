export const toMinorUnits = (value: number | string | { toString(): string }): number =>
  Math.round(Number(value) * 100);

export const SESSION_COMPLETE = "complete";
export const SESSION_EXPIRED = "expired";
export const SESSION_OPEN = "open";
export const PAYMENT_STATUS_PAID = "paid";

export type SessionOutcome = "paid" | "expired" | "open" | "unknown";

export const sessionOutcomeOf = (
  status: string | null,
  paymentStatus: string | null,
): SessionOutcome => {
  if (status === SESSION_EXPIRED) {
    return "expired";
  }

  if (status === SESSION_COMPLETE && paymentStatus === PAYMENT_STATUS_PAID) {
    return "paid";
  }

  if (status === SESSION_OPEN) {
    return "open";
  }

  return "unknown";
};
