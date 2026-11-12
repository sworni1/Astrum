"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import type {
  ReviewComment,
  ReviewCommentPage,
} from "@/common/types/review.types";
import { useFetcher } from "@/hooks/useFetcher";
import { mergeCommentPages } from "./commentPages";
import { reviewCommentsKey, reviewCommentsPageKey } from "./reviewsKeys";

type ExtraPages = { reviewId: string; pages: ReviewCommentPage[] };

const NO_PAGES: ReviewCommentPage[] = [];

/**
 * One page at a time, oldest first. A row this customer just wrote is held in
 * its own list below the loaded pages, because the thread pages oldest first
 * and a new row is not provably last while pages remain unloaded (AC-11). A
 * deleted row is patched in place, so the stub never depends on a re read.
 */
export const useReviewComments = (reviewId: string) => {
  const { getData } = useFetcher();

  const {
    data: firstPage,
    error,
    isLoading,
    mutate: revalidateThread,
  } = useSWR<ReviewCommentPage>(reviewCommentsKey(reviewId), getData);

  const [extra, setExtra] = useState<ExtraPages>({ reviewId, pages: [] });
  const [created, setCreated] = useState<ReviewComment[]>([]);
  const [patches, setPatches] = useState<Record<string, ReviewComment>>({});
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  const pages = extra.reviewId === reviewId ? extra.pages : NO_PAGES;
  const lastPage = pages.length > 0 ? pages[pages.length - 1] : firstPage;
  const loaded = mergeCommentPages([firstPage, ...pages]);
  const loadedIds = new Set(loaded.map((comment) => comment.id));
  const rows = [
    ...loaded,
    ...created.filter((comment) => !loadedIds.has(comment.id)),
  ];
  const comments = rows.map((row) => patches[row.id] ?? row);

  const loadMore = useCallback(async (): Promise<void> => {
    const cursor = lastPage?.nextCursor;

    if (!cursor || !lastPage?.hasNextPage || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setLoadMoreFailed(false);

    try {
      const page = (await getData(
        reviewCommentsPageKey(reviewId, cursor),
      )) as ReviewCommentPage;

      setExtra((current) => ({
        reviewId,
        pages: [...(current.reviewId === reviewId ? current.pages : []), page],
      }));
    } catch {
      setLoadMoreFailed(true);
    } finally {
      setIsLoadingMore(false);
    }
  }, [getData, isLoadingMore, lastPage, reviewId]);

  const retry = useCallback(async (): Promise<void> => {
    setLoadMoreFailed(false);
    await revalidateThread().catch(() => undefined);
  }, [revalidateThread]);

  const rememberCreated = useCallback((comment: ReviewComment): void => {
    setCreated((current) => [...current, comment]);
  }, []);

  const patchComment = useCallback((comment: ReviewComment): void => {
    setPatches((current) => ({ ...current, [comment.id]: comment }));
  }, []);

  return {
    comments,
    hasNextPage: lastPage?.hasNextPage ?? false,
    isLoading,
    hasFailed: Boolean(error),
    loadMore,
    isLoadingMore,
    loadMoreFailed,
    retry,
    rememberCreated,
    patchComment,
  };
};
