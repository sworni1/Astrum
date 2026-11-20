"use client";

import useSWRMutation from "swr/mutation";
import type {
  CreateReviewCommentDto,
  ReviewCommentWriteAnswer,
} from "@/common/types/review.types";
import { useFetcher } from "@/hooks/useFetcher";
import { reviewCommentsKey, reviewCommentCreateKey } from "./reviewsKeys";

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
