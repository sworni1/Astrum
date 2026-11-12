/**
 * The one decimal to minor unit conversion in the feature: session creation and
 * the amount comparison both read it, so they cannot disagree (AC-6, invariant 5).
 */
export const toMinorUnits = (value: number | string | { toString(): string }): number =>
  Math.round(Number(value) * 100);

/** The session status a paid callback carries, and the one an abandoned one does. */
export const SESSION_COMPLETE = "complete";
export const SESSION_EXPIRED = "expired";
export const SESSION_OPEN = "open";
export const PAYMENT_STATUS_PAID = "paid";

export type SessionOutcome = "paid" | "expired" | "open" | "unknown";

/** What a retrieved session means for the order, decided in one place (AC-9, AC-10). */
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
