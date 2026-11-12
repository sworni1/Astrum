"use client";

import useSWRMutation from "swr/mutation";
import type {
  CreateReviewCommentDto,
  ReviewCommentWriteAnswer,
} from "@/common/types/review.types";
import { useFetcher } from "@/hooks/useFetcher";
import { reviewCommentsKey, reviewCommentCreateKey } from "./reviewsKeys";

/**
 * The create answers the row and the counter, and the thread keeps that row
 * itself, so nothing here re reads the list (spec 0014, AC-11).
 */
export const useCreateReviewComment = (reviewId: string) => {
  const { postItem } = useFetcher();

  const { trigger, isMutating, error } = useSWRMutation<
    ReviewCommentWriteAnswer,
    unknown,
    string,
    CreateReviewCommentDto
  >(reviewCommentCreateKey(reviewId), postItem);

  return {
    createCommentTrigger: trigger,
    isCreatingComment: isMutating,
    createCommentError: error ?? null,
    threadKey: reviewCommentsKey(reviewId),
  };
};
