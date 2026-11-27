import {
  LOGGED_SID_LENGTH,
  SESSION_KEY_PREFIX,
} from "../constants/redis.constants";

export const sessionKey = (sid: string): string =>
  `${SESSION_KEY_PREFIX}${sid}`;

export const loggedSid = (sid: string): string =>
  sid.slice(0, LOGGED_SID_LENGTH);
