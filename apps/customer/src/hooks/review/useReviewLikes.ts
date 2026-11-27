"use client";

import { useCallback, useRef, useState } from "react";
import useSWR from "swr";
import type {
  ReviewLikeAnswer,
  ReviewLikedSet,
} from "@/common/types/review.types";
import { useFetcher } from "@/hooks/useFetcher";
import { reviewLikeKey, reviewLikesKey } from "./reviewsKeys";

type Overrides = {
  productId: string;
  liked: Record<string, boolean>;
};

const NO_OVERRIDES: Record<string, boolean> = {};

export type ReviewLikes = {
  isLiked: (reviewId: string) => boolean;
  isPending: (reviewId: string) => boolean;

  toggle: (reviewId: string) => Promise<ReviewLikeAnswer | null>;
};

export const useReviewLikes = (productId: string): ReviewLikes => {
  const { getData, putItem, deleteItem } = useFetcher();
  const { data, mutate: revalidateLikedSet } = useSWR<ReviewLikedSet>(
    reviewLikesKey(productId),
    getData,
  );

  const [overrides, setOverrides] = useState<Overrides>({
    productId,
    liked: NO_OVERRIDES,
  });
  const [pending, setPending] = useState<string[]>([]);
  const inFlight = useRef<Set<string>>(new Set());

  const answered = data?.reviewIds;
  const local =
    overrides.productId === productId ? overrides.liked : NO_OVERRIDES;

  const isLiked = useCallback(
    (reviewId: string): boolean => {
      const override = local[reviewId];

      if (override !== undefined) {
        return override;
      }

      return answered?.includes(reviewId) ?? false;
    },
    [answered, local],
  );

  const isPending = useCallback(
    (reviewId: string): boolean => pending.includes(reviewId),
    [pending],
  );

  const writeOverride = useCallback(
    (reviewId: string, liked: boolean): void => {
      setOverrides((current) => ({
        productId,
        liked: {
          ...(current.productId === productId ? current.liked : NO_OVERRIDES),
          [reviewId]: liked,
        },
      }));
    },
    [productId],
  );

  const toggle = useCallback(
    async (reviewId: string): Promise<ReviewLikeAnswer | null> => {
      if (inFlight.current.has(reviewId)) {
        return null;
      }

      const wasLiked = isLiked(reviewId);
      const next = !wasLiked;

      inFlight.current.add(reviewId);
      setPending((current) => [...current, reviewId]);
      writeOverride(reviewId, next);

      try {
        const answer = next
          ? ((await putItem(reviewLikeKey(reviewId))) as ReviewLikeAnswer)
          : ((await deleteItem(reviewLikeKey(reviewId))) as ReviewLikeAnswer);

        writeOverride(reviewId, answer.liked);

        return answer;
      } catch (error) {
        writeOverride(reviewId, wasLiked);

        await revalidateLikedSet().catch(() => undefined);

        throw error;
      } finally {
        inFlight.current.delete(reviewId);
        setPending((current) => current.filter((id) => id !== reviewId));
      }
    },
    [deleteItem, isLiked, putItem, revalidateLikedSet, writeOverride],
  );

  return { isLiked, isPending, toggle };
};
