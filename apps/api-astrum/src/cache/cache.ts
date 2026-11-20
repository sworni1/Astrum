import { logger } from "../common/helpers/logger";
import { describeError } from "../events/describe-error";
import { cacheKeys } from "./cacheKeys";
import { type CacheStore, getCacheStore } from "./cacheStore";

export const DEFAULT_LIST_TTL_SECONDS = 30;

export const DEFAULT_PRODUCT_TTL_SECONDS = 60;

const LIST_TTL_JITTER_SECONDS = 4;
const PRODUCT_TTL_JITTER_SECONDS = 7;

const readSeconds = (raw: string | undefined, fallback: number): number => {
  const value = Number(raw);

  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const listTtlSeconds = (): number =>
  readSeconds(process.env.CACHE_LIST_TTL_SECONDS, DEFAULT_LIST_TTL_SECONDS) +
  Math.floor(Math.random() * LIST_TTL_JITTER_SECONDS);

export const productTtlSeconds = (): number =>
  readSeconds(
    process.env.CACHE_PRODUCT_TTL_SECONDS,
    DEFAULT_PRODUCT_TTL_SECONDS,
  ) + Math.floor(Math.random() * PRODUCT_TTL_JITTER_SECONDS);

const warnCacheError = (key: string, error: unknown): void => {
  logger.warn({ event: "cache.error", key, reason: describeError(error) });
};

const readPayload = async (
  store: CacheStore,
  key: string,
): Promise<string | null> => {
  try {
    return await store.get(key);
  } catch (error) {
    warnCacheError(key, error);
    return null;
  }
};

const writePayload = async (
  store: CacheStore,
  key: string,
  payload: string,
  ttlSeconds: number,
): Promise<void> => {
  try {
    await store.setWithTtl(key, payload, ttlSeconds);
  } catch (error) {
    warnCacheError(key, error);
  }
};

const parsePayload = <T>(payload: string): T | null => {
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
};

export type GetOrSetOptions<T> = {
  key: string;
  ttlSeconds: number;

  load: () => Promise<T>;

  epochKey?: string;
};

export const getOrSet = async <T>({
  key,
  ttlSeconds,
  load,
  epochKey,
}: GetOrSetOptions<T>): Promise<T> => {
  const store = getCacheStore();

  if (store === null) {
    return await load();
  }

  const startedAt = Date.now();
  const cached = await readPayload(store, key);
  const stored = cached === null ? null : parsePayload<T>(cached);
  const hit = stored !== null;

  let value: T;

  if (stored !== null) {
    value = stored;
  } else {
    const loaded = await load();
    const payload = JSON.stringify(loaded);

    await writePayload(store, key, payload, ttlSeconds);
    value = JSON.parse(payload) as T;
  }

  logger.info({
    event: "cache.read",
    key,
    ...(epochKey ? { epochKey } : {}),
    hit,
    ms: Date.now() - startedAt,
  });

  return value;
};

export const readVersion = async (counterKey: string): Promise<number> => {
  const store = getCacheStore();

  if (store === null) {
    return 0;
  }

  const raw = await readPayload(store, counterKey);
  const version = Number(raw);

  return Number.isInteger(version) && version > 0 ? version : 0;
};

const invalidate = async (keys: readonly string[]): Promise<void> => {
  const store = getCacheStore();

  if (store === null || keys.length === 0) {
    return;
  }

  try {
    await store.incrementAll(keys);
  } catch (error) {
    logger.warn({
      event: "cache.invalidate.error",
      keys,
      reason: describeError(error),
    });
  }
};

const unique = (values: readonly string[]): string[] => [...new Set(values)];

export const invalidateLists = async (): Promise<void> => {
  await invalidate([cacheKeys.listsEpoch()]);
};

export const invalidateReviews = async (productId: string): Promise<void> => {
  await invalidate([cacheKeys.reviewsVersion(productId)]);
};

export const invalidateProducts = async (
  productIds: readonly string[],
): Promise<void> => {
  await invalidate([
    cacheKeys.listsEpoch(),
    ...unique(productIds).map(cacheKeys.productVersion),
  ]);
};

export const invalidateShipping = async (): Promise<void> => {
  const store = getCacheStore();

  if (store === null) {
    return;
  }

  const key = cacheKeys.shipping();

  try {
    await store.remove(key);
  } catch (error) {
    logger.warn({
      event: "cache.invalidate.error",
      keys: [key],
      reason: describeError(error),
    });
  }
};
