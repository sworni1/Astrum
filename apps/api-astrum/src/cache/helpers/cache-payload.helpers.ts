import { describeError } from "../../common/helpers/describeError";
import { logger } from "../../common/helpers/logger";
import type { CacheStore } from "../types/cache.types";

const warnCacheError = (key: string, error: unknown): void => {
  logger.warn({ event: "cache.error", key, reason: describeError(error) });
};

export const readPayload = async (
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

export const writePayload = async (
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

export const parsePayload = <T>(payload: string): T | null => {
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
};
