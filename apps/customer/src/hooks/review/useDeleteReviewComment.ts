"use client";

import useSWRMutation from "swr/mutation";
import type { ReviewCommentWriteAnswer } from "@/common/types/review.types";
import { useFetcher } from "@/hooks/useFetcher";
import { reviewCommentKey } from "./reviewsKeys";

/**
 * The delete answers the stub and the counter, so the thread writes what the
 * server handed it instead of inventing a stub (spec 0014, AC-10).
 */
export const useDeleteReviewComment = (reviewId: string, commentId: string) => {
  const { deleteItem } = useFetcher();

  const { trigger, isMutating, error } = useSWRMutation<
    ReviewCommentWriteAnswer,
    unknown,
    string
  >(reviewCommentKey(reviewId, commentId), deleteItem);

  return {
    deleteCommentTrigger: trigger,
    isDeletingComment: isMutating,
    deleteCommentError: error ?? null,
  };
};
