"use client";

import { useCallback, useState } from "react";

type CountMaps = {
  likes: Record<string, number>;
  comments: Record<string, number>;
};

const NO_COUNTS: CountMaps = { likes: {}, comments: {} };

export type ReviewCounts = {
  likeCountOf: (reviewId: string, stored: number) => number;
  commentCountOf: (reviewId: string, stored: number) => number;
  setLikeCount: (reviewId: string, value: number) => void;
  setCommentCount: (reviewId: string, value: number) => void;
};

/**
 * The number a row prints is the stored one until this customer moves it, then
 * the answered value for the rest of the visit (spec 0014, AC-6, AC-12). One
 * map per number, keyed by review id, so a row from an appended page moves too.
 */
export const useReviewCounts = (): ReviewCounts => {
  const [counts, setCounts] = useState<CountMaps>(NO_COUNTS);

  const likeCountOf = useCallback(
    (reviewId: string, stored: number) => counts.likes[reviewId] ?? stored,
    [counts.likes],
  );

  const commentCountOf = useCallback(
    (reviewId: string, stored: number) => counts.comments[reviewId] ?? stored,
    [counts.comments],
  );

  const setLikeCount = useCallback((reviewId: string, value: number): void => {
    setCounts((current) => ({
      ...current,
      likes: { ...current.likes, [reviewId]: value },
    }));
  }, []);

  const setCommentCount = useCallback(
    (reviewId: string, value: number): void => {
      setCounts((current) => ({
        ...current,
        comments: { ...current.comments, [reviewId]: value },
      }));
    },
    [],
  );

  return { likeCountOf, commentCountOf, setLikeCount, setCommentCount };
};
