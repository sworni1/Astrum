import { describeError } from "../../common/helpers/describeError";
import { logger } from "../../common/helpers/logger";
import { cacheKeys } from "../cacheKeys";
import { getCacheStore } from "../cacheStore";

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
