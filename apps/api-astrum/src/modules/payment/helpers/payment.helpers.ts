import type { Order } from "@astrum/db/client";
import {
  HANDLED_EVENT_TYPES,
  SESSION_PAYMENT_STATUS_PAID,
  SESSION_STATUS_COMPLETE,
  SESSION_STATUS_EXPIRED,
  SESSION_STATUS_OPEN,
} from "../constants/payment.constants";
import type { SessionOutcome } from "../types/payment.types";

export const toMinorUnits = (
  value: number | string | { toString(): string },
): number => Math.round(Number(value) * 100);

export const amountMatchesOrder = (
  order: Order,
  amount: number | null,
  currency: string | null,
): boolean => {
  if (amount === null || currency === null) {
    return false;
  }

  return (
    amount === toMinorUnits(order.grandTotal) &&
    currency.toLowerCase() === order.currency.toLowerCase()
  );
};

export const sessionOutcomeOf = (
  status: string | null,
  paymentStatus: string | null,
): SessionOutcome => {
  if (status === SESSION_STATUS_EXPIRED) {
    return "expired";
  }

  if (
    status === SESSION_STATUS_COMPLETE &&
    paymentStatus === SESSION_PAYMENT_STATUS_PAID
  ) {
    return "paid";
  }

  if (status === SESSION_STATUS_OPEN) {
    return "open";
  }

  return "unknown";
};

export const isHandledEventType = (type: string): boolean =>
  HANDLED_EVENT_TYPES.includes(type);
