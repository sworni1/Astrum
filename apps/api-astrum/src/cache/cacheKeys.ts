import { createHash } from "node:crypto";

/** Cached payloads: every key here carries a lifetime (spec 0022, AC-10). */
const PAYLOAD_PREFIX = "cache:v1:";

/** Counters the payload keys name. Permanent on purpose: they outlive their payloads. */
const COUNTER_PREFIX = "cache:meta:";

/** 64 bits of digest: the search text never reaches Redis in clear, and stays short. */
const DIGEST_LENGTH = 16;

const digest = (value: string): string =>
  createHash("sha256").update(value).digest("hex").slice(0, DIGEST_LENGTH);

/**
 * One builder per key, so a write and a read can never disagree about a name.
 * A list key names the catalogue epoch, a product key names the product's own
 * version, and every payload key is built from the counter it depends on.
 */
export const cacheKeys = {
  product: (productId: string, version: number): string =>
    `${PAYLOAD_PREFIX}product:${productId}:v${version}`,

  productVersion: (productId: string): string =>
    `${COUNTER_PREFIX}ver:product:${productId}`,

  /** The page shape is part of the key: two raw limits that clamp alike share it. */
  reviews: (
    productId: string,
    version: number,
    limit: number,
    after: string | undefined,
  ): string =>
    `${PAYLOAD_PREFIX}reviews:${productId}:v${version}:${limit}:${after}`,

  reviewsVersion: (productId: string): string =>
    `${COUNTER_PREFIX}ver:reviews:${productId}`,

  listsEpoch: (): string => `${COUNTER_PREFIX}epoch:lists`,

  recommendations: (epoch: number, cursor: string | undefined): string =>
    `${PAYLOAD_PREFIX}lists:${epoch}:recs:${digest(cursor ?? "")}`,

  category: (
    epoch: number,
    category: string | undefined,
    searchQuery: string | undefined,
    cursor: string | undefined,
  ): string =>
    `${PAYLOAD_PREFIX}lists:${epoch}:cat:${String(category)}:${digest(
      `${searchQuery ?? ""}\u0000${cursor ?? ""}`,
    )}`,

  shipping: (): string => `${PAYLOAD_PREFIX}shipping`,
} as const;
