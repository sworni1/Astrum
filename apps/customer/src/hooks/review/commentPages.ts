import type {
  ReviewComment,
  ReviewCommentPage,
} from "@/common/types/review.types";

/**
 * Appends the loaded pages below the first one without repeating a comment id,
 * so the thread never prints the same row twice (spec 0014, AC-11).
 */
export const mergeCommentPages = (
  pages: (ReviewCommentPage | undefined)[],
): ReviewComment[] => {
  const seen = new Set<string>();
  const merged: ReviewComment[] = [];

  for (const page of pages) {
    for (const comment of page?.comments ?? []) {
      if (seen.has(comment.id)) {
        continue;
      }

      seen.add(comment.id);
      merged.push(comment);
    }
  }

  return merged;
};
