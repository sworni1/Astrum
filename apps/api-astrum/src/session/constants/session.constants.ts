import type { RedisOptions } from "ioredis";

export const SESSION_TTL_SECONDS = 86_400;

export const SESSION_KEY_PREFIX = "session:";

export const LOGGED_SID_LENGTH = 8;

export const SESSION_COMMAND_TIMEOUT_MS = 1_000;

export const SESSION_CLIENT_OPTIONS: RedisOptions = {
  commandTimeout: SESSION_COMMAND_TIMEOUT_MS,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
};
