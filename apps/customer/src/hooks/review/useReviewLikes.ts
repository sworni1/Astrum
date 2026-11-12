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
  /** `null` means a request for this review was already in flight. */
  toggle: (reviewId: string) => Promise<ReviewLikeAnswer | null>;
};

/**
 * The caller's own liked set for one product, and the press that moves it.
 * A press is optimistic: the override flips before the answer, and the answer
 * corrects it. On failure the override goes back and the set is re read, so a
 * refusal never leaves a control showing a state the server does not hold
 * (spec 0014, AC-3, AC-6).
 */
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

  /**
   * One request per review: a second press while the first runs returns before
   * sending, and `null` tells the caller that nothing left the browser.
   */
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

        // Never rejects: a failed re read must not replace the real refusal.
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
