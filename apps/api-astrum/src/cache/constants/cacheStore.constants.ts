import type { RedisOptions } from "ioredis";

export const CACHE_COMMAND_TIMEOUT_MS = 100;

export const CACHE_CONNECT_TIMEOUT_MS = 100;

export const CACHE_RETRY_CAP_MS = 2_000;

export const CACHE_RETRY_BASE_DELAY_MS = 200;

export const CACHE_CLIENT_OPTIONS: RedisOptions = {
  commandTimeout: CACHE_COMMAND_TIMEOUT_MS,
  connectTimeout: CACHE_CONNECT_TIMEOUT_MS,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  retryStrategy: (attempt: number): number =>
    Math.min(attempt * CACHE_RETRY_BASE_DELAY_MS, CACHE_RETRY_CAP_MS),
};
