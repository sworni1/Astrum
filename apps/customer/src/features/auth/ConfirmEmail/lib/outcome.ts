import { Clock, MailCheck, MailWarning, MailX } from "lucide-react";

export type Outcome = "ok" | "expired" | "used" | "invalid";

export type ViewKeys = {
  title: "okTitle" | "expiredTitle" | "usedTitle" | "invalidTitle";
  text: "okText" | "expiredText" | "usedText" | "invalidText";
};

export const VIEW_KEYS: Record<Outcome, ViewKeys> = {
  ok: { title: "okTitle", text: "okText" },
  expired: { title: "expiredTitle", text: "expiredText" },
  used: { title: "usedTitle", text: "usedText" },
  invalid: { title: "invalidTitle", text: "invalidText" },
};

export const OUTCOME_ICONS: Record<Outcome, typeof MailCheck> = {
  ok: MailCheck,
  expired: Clock,
  used: MailWarning,
  invalid: MailX,
};

export const isOutcome = (value: string | null): value is Outcome =>
  value === "ok" ||
  value === "expired" ||
  value === "used" ||
  value === "invalid";
