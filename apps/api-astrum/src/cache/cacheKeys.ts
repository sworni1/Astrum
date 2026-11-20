import { createHash } from "node:crypto";

const PAYLOAD_PREFIX = "cache:v1:";

const COUNTER_PREFIX = "cache:meta:";

const DIGEST_LENGTH = 16;

const digest = (value: string): string =>
  createHash("sha256").update(value).digest("hex").slice(0, DIGEST_LENGTH);

export const cacheKeys = {
  product: (productId: string, version: number): string =>
    `${PAYLOAD_PREFIX}product:${productId}:v${version}`,

  productVersion: (productId: string): string =>
    `${COUNTER_PREFIX}ver:product:${productId}`,

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
