import Redis, { type RedisOptions } from "ioredis";

import { describeError } from "../common/helpers/describeError";
import { logger } from "../common/helpers/logger";
import { withTimeout } from "../common/helpers/timeout";
import {
  CACHE_CLIENT_OPTIONS,
  CACHE_COMMAND_TIMEOUT_MS,
} from "./constants/cacheStore.constants";
import { failedCommand } from "./helpers/cache-pipeline.helpers";
import type { CacheClientSurface, CacheStore } from "./types/cache.types";

export const createCacheStore = (
  url: string,
  factory: (url: string, options: RedisOptions) => CacheClientSurface = (
    target,
    options,
  ) => new Redis(target, options),
): CacheStore => {
  const client = factory(url, CACHE_CLIENT_OPTIONS);

  client.on("error", (error: Error) => {
    logger.warn({ event: "cache.connection", reason: describeError(error) });
  });

  return {
    get: async (key) =>
      await withTimeout(
        client.get(key),
        CACHE_COMMAND_TIMEOUT_MS,
        "cache command over budget",
      ),
    setWithTtl: async (key, value, ttlSeconds) =>
      await withTimeout(
        client.set(key, value, "EX", ttlSeconds),
        CACHE_COMMAND_TIMEOUT_MS,
        "cache command over budget",
      ),
    incrementAll: async (keys) => {
      const pipeline = client.pipeline();

      for (const key of keys) {
        pipeline.incr(key);
      }

      const results = await withTimeout(
        pipeline.exec(),
        CACHE_COMMAND_TIMEOUT_MS,
        "cache command over budget",
      );
      const failure = failedCommand(results);

      if (failure !== null) {
        throw failure;
      }

      return results;
    },
    remove: async (key) =>
      await withTimeout(
        client.del(key),
        CACHE_COMMAND_TIMEOUT_MS,
        "cache command over budget",
      ),
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
