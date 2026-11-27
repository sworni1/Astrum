import type { ReviewPage } from "@/common/types/review.types";

export const NO_PAGES: never[] = [];

export const reviewsKey = (productId: string): string =>
  `/products/${productId}/reviews`;

export const reviewsPageKey = (productId: string, cursor: string): string =>
  `${reviewsKey(productId)}?after=${cursor}`;

export const productKey = (productId: string): string =>
  `/products/${productId}`;

export const reviewLikesKey = (productId: string): string =>
  `/products/${productId}/review-likes`;

export const reviewLikeKey = (reviewId: string): string =>
  `/reviews/${reviewId}/like`;

export const reviewCommentsKey = (reviewId: string): string =>
  `/reviews/${reviewId}/comments`;

export const reviewCommentsPageKey = (
  reviewId: string,
  cursor: string,
): string => `${reviewCommentsKey(reviewId)}?after=${cursor}`;

export const reviewCommentCreateKey = (reviewId: string): string =>
  `${reviewCommentsKey(reviewId)}#create`;

export const reviewCommentKey = (reviewId: string, commentId: string): string =>
  `${reviewCommentsKey(reviewId)}/${commentId}`;

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
