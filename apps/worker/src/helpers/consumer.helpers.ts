import type { ConsumeMessage } from "amqplib";
import { resolveLetterLocale } from "./letter.helpers";

export type ConfirmationEvent = {
  userId: string;
  email: string;
  requestedAt?: string;
  locale: "en" | "ru";
};

export const parseEvent = (
  message: ConsumeMessage,
): ConfirmationEvent | undefined => {
  try {
    const parsed = JSON.parse(message.content.toString("utf8")) as Partial<
      Record<keyof ConfirmationEvent, unknown>
    >;

    if (typeof parsed.userId !== "string" || !parsed.userId) {
      return undefined;
    }

    if (typeof parsed.email !== "string" || !parsed.email) {
      return undefined;
    }

    return {
      userId: parsed.userId,
      email: parsed.email,
      requestedAt:
        typeof parsed.requestedAt === "string" ? parsed.requestedAt : undefined,
      locale: resolveLetterLocale(parsed.locale),
    };
  } catch {
    return undefined;
  }
};
