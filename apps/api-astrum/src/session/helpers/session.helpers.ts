import {
  LOGGED_SID_LENGTH,
  SESSION_KEY_PREFIX,
} from "../constants/session.constants";

export const sessionKey = (sid: string): string =>
  `${SESSION_KEY_PREFIX}${sid}`;

export const loggedSid = (sid: string): string =>
  sid.slice(0, LOGGED_SID_LENGTH);

export const sessionOwner = (raw: string): string | undefined => {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) {
      return undefined;
    }

    const { userId } = parsed as { userId?: unknown };

    return typeof userId === "string" ? userId : undefined;
  } catch {
    return undefined;
  }
};
