import {
  DEFAULT_LIST_TTL_SECONDS,
  DEFAULT_PRODUCT_TTL_SECONDS,
  LIST_TTL_JITTER_SECONDS,
  PRODUCT_TTL_JITTER_SECONDS,
} from "../constants/cache.constants";

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
