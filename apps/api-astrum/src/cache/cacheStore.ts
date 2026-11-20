import Redis, { type RedisOptions } from "ioredis";

import { logger } from "../common/helpers/logger";
import { describeError } from "../events/describe-error";

export const CACHE_COMMAND_TIMEOUT_MS = 100;

export const CACHE_CONNECT_TIMEOUT_MS = 100;

export const CACHE_RETRY_CAP_MS = 2_000;

export type CacheStore = {
  get(key: string): Promise<string | null>;
  setWithTtl(key: string, value: string, ttlSeconds: number): Promise<unknown>;
  incrementAll(keys: readonly string[]): Promise<unknown>;
  remove(key: string): Promise<unknown>;
  quit(): Promise<unknown>;
};

export const CACHE_CLIENT_OPTIONS: RedisOptions = {
  commandTimeout: CACHE_COMMAND_TIMEOUT_MS,
  connectTimeout: CACHE_CONNECT_TIMEOUT_MS,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  retryStrategy: (attempt: number): number =>
    Math.min(attempt * 200, CACHE_RETRY_CAP_MS),
};

type CacheClient = Pick<Redis, "get" | "set" | "del" | "pipeline" | "on" | "quit">;

export type CacheClientSurface = CacheClient;

const withBudget = async <T>(work: Promise<T>): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;

  const budget = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error("cache command over budget")),
      CACHE_COMMAND_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([work, budget]);
  } finally {
    clearTimeout(timer);
  }
};

const failedCommand = (results: unknown): Error | null => {
  if (!Array.isArray(results)) {
    return new Error("cache pipeline answered nothing");
  }

  for (const entry of results) {
    if (!Array.isArray(entry)) {
      continue;
    }

    const [error] = entry as [unknown, unknown];

    if (error !== null && error !== undefined) {
      return error instanceof Error ? error : new Error(String(error));
    }
  }

  return null;
};

export const createCacheStore = (
  url: string,
  factory: (url: string, options: RedisOptions) => CacheClient = (target, options) =>
    new Redis(target, options),
): CacheStore => {
  const client = factory(url, CACHE_CLIENT_OPTIONS);

  client.on("error", (error: Error) => {
    logger.warn({ event: "cache.connection", reason: describeError(error) });
  });

  return {
    get: async (key) => await withBudget(client.get(key)),
    setWithTtl: async (key, value, ttlSeconds) =>
      await withBudget(client.set(key, value, "EX", ttlSeconds)),
    incrementAll: async (keys) => {
      const pipeline = client.pipeline();

      for (const key of keys) {
        pipeline.incr(key);
      }

      const results = await withBudget(pipeline.exec());
      const failure = failedCommand(results);

      if (failure !== null) {
        throw failure;
      }

      return results;
    },
    remove: async (key) => await withBudget(client.del(key)),
    quit: async () => await client.quit(),
  };
};

export const isCacheEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.CACHE_ENABLED !== "false";

const isDisabled = (): boolean =>
  !isCacheEnabled() || process.env.NODE_ENV === "test";

let store: CacheStore | null | undefined;

export const getCacheStore = (): CacheStore | null => {
  if (store !== undefined) {
    return store;
  }

  const url = process.env.CACHE_REDIS_URL?.trim() || process.env.REDIS_URL;
  store = isDisabled() || !url ? null : createCacheStore(url);

  return store;
};

export const closeCacheStore = async (): Promise<void> => {
  const open = store ?? null;
  store = null;

  if (open === null) {
    return;
  }

  try {
    await open.quit();
  } catch (error) {
    logger.warn({ event: "cache.close.error", reason: describeError(error) });
  }
};
