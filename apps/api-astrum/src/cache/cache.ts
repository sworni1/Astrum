import { logger } from "../common/helpers/logger";
import { describeError } from "../events/describe-error";
import { cacheKeys } from "./cacheKeys";
import { type CacheStore, getCacheStore } from "./cacheStore";

/** The base lifetime of a list key, before the jitter (spec 0022, AC-13). */
export const DEFAULT_LIST_TTL_SECONDS = 30;

/** The base lifetime of a product or reviews key, before the jitter (AC-13). */
export const DEFAULT_PRODUCT_TTL_SECONDS = 60;

/** A list lives 30 through 33 seconds, a product 60 through 66 (AC-1, AC-10). */
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

/** One line per failed cache operation, so a degraded cache is visible (AC-8). */
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
  /** The loader runs only on a miss; its answer is serialized once and stored. */
  load: () => Promise<T>;
  /** The counter a list key names, logged beside the key because that read touches two. */
  epochKey?: string;
};

/**
 * The shared part of an answer: Redis when a fresh key exists, the loader
 * otherwise. A cache failure never reaches the caller: it is logged and the
 * answer comes from the database exactly as it would with the cache off.
 */
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

/** A counter's value, or `0` when the key was never written (AC-2, AC-5). */
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

/** A new product or a changed card: every list key names a fresh epoch (AC-7 e). */
export const invalidateLists = async (): Promise<void> => {
  await invalidate([cacheKeys.listsEpoch()]);
};

/** A like, a comment or a new review: the product's review pages go cold (AC-7 c, d). */
export const invalidateReviews = async (productId: string): Promise<void> => {
  await invalidate([cacheKeys.reviewsVersion(productId)]);
};

/**
 * A stock write: the lists epoch plus one version per product, in one pipelined
 * batch, after the commit (AC-7 a, b).
 */
export const invalidateProducts = async (
  productIds: readonly string[],
): Promise<void> => {
  await invalidate([
    cacheKeys.listsEpoch(),
    ...unique(productIds).map(cacheKeys.productVersion),
  ]);
};

/** Shipping has no writer route today, so its lifetime is the bound (AC-6). */
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
