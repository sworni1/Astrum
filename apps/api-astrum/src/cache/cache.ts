import { logger } from "../common/helpers/logger";
import { getCacheStore } from "./cacheStore";
import {
  parsePayload,
  readPayload,
  writePayload,
} from "./helpers/cache-payload.helpers";

export {
  DEFAULT_LIST_TTL_SECONDS,
  DEFAULT_PRODUCT_TTL_SECONDS,
} from "./constants/cache.constants";

export {
  invalidateLists,
  invalidateProducts,
  invalidateReviews,
  invalidateShipping,
} from "./helpers/cache-invalidation.helpers";

export {
  listTtlSeconds,
  productTtlSeconds,
} from "./helpers/cache-ttl.helpers";

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
