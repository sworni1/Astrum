import type { ReviewPage } from "@/common/types/review.types";

/** One key for the first page, so the header and the block share one request. */
export const reviewsKey = (productId: string): string =>
  `/products/${productId}/reviews`;

/** One key per appended page; the cursor is the id of the last row on screen. */
export const reviewsPageKey = (productId: string, cursor: string): string =>
  `${reviewsKey(productId)}?after=${cursor}`;

export const productKey = (productId: string): string =>
  `/products/${productId}`;

/** The caller's own liked set of this product (spec 0014, AC-3). */
export const reviewLikesKey = (productId: string): string =>
  `/products/${productId}/review-likes`;

/** One review's like toggle; the method decides the direction (AC-4). */
export const reviewLikeKey = (reviewId: string): string =>
  `/reviews/${reviewId}/like`;

/** One key for the thread's first page (spec 0014, AC-7). */
export const reviewCommentsKey = (reviewId: string): string =>
  `/reviews/${reviewId}/comments`;

/** One key per appended comment page; the cursor is the last comment's id. */
export const reviewCommentsPageKey = (
  reviewId: string,
  cursor: string,
): string => `${reviewCommentsKey(reviewId)}?after=${cursor}`;

/** The create of one review's thread. */
export const reviewCommentCreateKey = (reviewId: string): string =>
  `${reviewCommentsKey(reviewId)}#create`;

/** The delete of one comment. */
export const reviewCommentKey = (reviewId: string, commentId: string): string =>
  `${reviewCommentsKey(reviewId)}/${commentId}`;

/**
 * Appends the loaded pages below the first one without repeating an id. The
 * order stays the order the gateway answered (AC-4).
 */
export const mergeReviewPages = (
  pages: (ReviewPage | undefined)[],
): ReviewPage["reviews"] => {
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
