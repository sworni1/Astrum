import {
  OUTBOX_ADDRESS_PATTERN,
  OUTBOX_TIMESTAMP_PATTERN,
} from "../constants/mailer.constants";

export const outboxFileName = (to: string, now: Date): string => {
  const stamp = now.toISOString().replace(OUTBOX_TIMESTAMP_PATTERN, "-");
  const safeTo = to.replace(OUTBOX_ADDRESS_PATTERN, "_");

  return `${stamp}-${safeTo}.eml`;
};
