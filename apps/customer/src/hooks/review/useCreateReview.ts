"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type {
  CreateReviewDto,
  ProductReview,
  ReviewCreateError,
} from "@/common/types/review.types";
import { useFetcher } from "@/hooks/useFetcher";
import { productKey, reviewsKey } from "./reviewsKeys";

export const useCreateReview = (productId: string) => {
  const { postItem } = useFetcher();
  const { mutate } = useSWRConfig();

  const reviewListKey = reviewsKey(productId);
  const productDetailKey = productKey(productId);

  /** Re reads the list and the product, and never rejects on a failed read. */
  const revalidateReviewData = useCallback(async (): Promise<void> => {
    await Promise.allSettled([
      mutate(reviewListKey),
      mutate(productDetailKey),
    ]);
  }, [mutate, productDetailKey, reviewListKey]);

  const {
    trigger: createReviewTrigger,
    isMutating: isCreatingReview,
    error: rawError,
  } = useSWRMutation<
    ProductReview,
    ReviewCreateError,
    string,
    CreateReviewDto
  >(`${reviewListKey}#create`, postItem, {
    onSuccess: async () => {
      // The new row stands first because the first page is read again, and the
      // product key follows so `reviewState` is re read (AC-9).
      await revalidateReviewData();
    },
  });

  return {
    createReviewTrigger,
    isCreatingReview,
    createReviewError: rawError ?? null,
    revalidateReviewData,
  };
};
