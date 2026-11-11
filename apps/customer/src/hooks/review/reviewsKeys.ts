import type { ReviewPage } from "@/common/types/review.types";

/** One key for the first page, so the header and the block share one request. */
export const reviewsKey = (productId: string): string =>
  `/products/${productId}/reviews`;

/** One key per appended page; the cursor is the id of the last row on screen. */
export const reviewsPageKey = (productId: string, cursor: string): string =>
  `${reviewsKey(productId)}?after=${cursor}`;

export const productKey = (productId: string): string => `/products/${productId}`;

/**
 * Appends the loaded pages below the first one without repeating an id. The
 * order stays the order the gateway answered (AC-4).
 */
export const mergeReviewPages = (pages: (ReviewPage | undefined)[]): ReviewPage["reviews"] => {
  const seen = new Set<string>();
  const merged: ReviewPage["reviews"] = [];

  for (const page of pages) {
    for (const review of page?.reviews ?? []) {
      if (seen.has(review.id)) {
        continue;
      }

      seen.add(review.id);
      merged.push(review);
    }
  }

  return merged;
};
