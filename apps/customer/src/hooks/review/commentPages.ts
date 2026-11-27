import type {
  ReviewComment,
  ReviewCommentPage,
} from "@/common/types/review.types";

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
