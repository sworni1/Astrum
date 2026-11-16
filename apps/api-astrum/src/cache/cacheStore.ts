import Redis, { type RedisOptions } from "ioredis";

import { logger } from "../common/helpers/logger";
import { describeError } from "../events/describe-error";

/**
 * A cache operation never holds a request longer than this, so a slow store
 * costs at most a tenth of a second (spec 0022, AC-9).
 */
export const CACHE_COMMAND_TIMEOUT_MS = 100;

/** The connect budget: a store that is not reachable fails at once instead of hanging. */
export const CACHE_CONNECT_TIMEOUT_MS = 100;

/** The reconnect wait is capped, so a dead store stays cheap to retry. */
export const CACHE_RETRY_CAP_MS = 2_000;

/** The four commands the cache path needs, and nothing else. */
export type CacheStore = {
  get(key: string): Promise<string | null>;
  setWithTtl(key: string, value: string, ttlSeconds: number): Promise<unknown>;
  incrementAll(keys: readonly string[]): Promise<unknown>;
  remove(key: string): Promise<unknown>;
  quit(): Promise<unknown>;
};

/**
 * Every option is a bound: an operation that overruns its command timeout is
 * rejected, a command issued while the socket is down is refused instead of
 * queued, and one retry is all a read gets.
 */
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

/** The client surface the store draws on, exported so a suite can fake it. */
export type CacheClientSurface = CacheClient;

/** A store that never settles must not hold a request either. */
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

/** A pipeline reports a command failure inside its own result, not by rejecting. */
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

/**
 * One client per process, built with the bounded options above. The error
 * listener writes one structured line, because a failing connection would
 * otherwise print ioredis's own unformatted output.
 */
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

      // A failed counter bump must reach the caller, or the invalidation reads
      // as applied while the payload keeps its lifetime (AC-8).
      if (failure !== null) {
        throw failure;
      }

      return results;
    },
    remove: async (key) => await withBudget(client.del(key)),
    quit: async () => await client.quit(),
  };
};

/** `CACHE_ENABLED=false` turns the cache off; every other value keeps it on. */
export const isCacheEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.CACHE_ENABLED !== "false";
/**
 * A suite gets no client at all: unit tests exercise the store through a fake,
 * and a real socket would only add a handle that keeps jest from exiting.
 */
const isDisabled = (): boolean =>
  !isCacheEnabled() || process.env.NODE_ENV === "test";

let store: CacheStore | null | undefined;

export const getCacheStore = (): CacheStore | null => {
  if (store !== undefined) {
    return store;
  }

  // An empty value counts as absent, so a template line without a password
  // falls back to the session store's own connection string.
  const url = process.env.CACHE_REDIS_URL?.trim() || process.env.REDIS_URL;
  store = isDisabled() || !url ? null : createCacheStore(url);

  return store;
};

/** The gateway's shutdown path reaches this, so a replica leaves no socket behind. */
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
