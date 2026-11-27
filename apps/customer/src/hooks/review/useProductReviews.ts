"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import type { ReviewPage } from "@/common/types/review.types";
import { useFetcher } from "@/hooks/useFetcher";
import {
  mergeReviewPages,
  NO_PAGES,
  reviewsKey,
  reviewsPageKey,
} from "./reviewsKeys";

type ExtraPages = { productId: string; pages: ReviewPage[] };

export const useProductReviews = (productId: string) => {
  const { getData } = useFetcher();

  const {
    data: firstPage,
    error: reviewError,
    isLoading: reviewsAreLoading,
    mutate: revalidateReviews,
  } = useSWR<ReviewPage>(reviewsKey(productId), getData);

  const [extra, setExtra] = useState<ExtraPages>({ productId, pages: [] });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  const pages = extra.productId === productId ? extra.pages : NO_PAGES;
  const lastPage = pages.length > 0 ? pages[pages.length - 1] : firstPage;
  const reviews = mergeReviewPages([firstPage, ...pages]);

  const loadMore = useCallback(async (): Promise<void> => {
    const cursor = lastPage?.nextCursor;

    if (!cursor || !lastPage?.hasNextPage || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setLoadMoreFailed(false);

    try {
      const page = (await getData(
        reviewsPageKey(productId, cursor),
      )) as ReviewPage;

      setExtra((current) => ({
        productId,
        pages: [
          ...(current.productId === productId ? current.pages : []),
          page,
        ],
      }));
    } catch {
      setLoadMoreFailed(true);
    } finally {
      setIsLoadingMore(false);
    }
  }, [getData, isLoadingMore, lastPage, productId]);

  const retry = useCallback(async (): Promise<void> => {
    setLoadMoreFailed(false);
    await revalidateReviews();
  }, [revalidateReviews]);

  return {
    reviews,
    aggregate: firstPage?.aggregate ?? null,
    reviewsAreLoading,
    reviewError,
    hasNextPage: lastPage?.hasNextPage ?? false,
    loadMore,
    isLoadingMore,
    loadMoreFailed,
    retry,
  };
};
