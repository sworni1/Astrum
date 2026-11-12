"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { showToast } from "@/common/helpers/showToast";
import type { ReviewCommentWriteAnswer } from "@/common/types/review.types";
import { Button } from "@/components/ui/button";
import ReviewCommentForm from "@/features/pages/ProductOverview/Reviews/components/ReviewCommentForm";
import ReviewCommentItem from "@/features/pages/ProductOverview/Reviews/components/ReviewCommentItem";
import { useReviewComments } from "@/hooks/review/useReviewComments";

type Props = {
  reviewId: string;
  /** The card prints the number, so the thread only reports the answer (AC-12). */
  onCountChange: (commentCount: number) => void;
};

/**
 * The flat thread under one review: oldest first, ten rows a page, a row this
 * customer just wrote held below the loaded pages, and the stub a delete
 * answered. It unmounts when the card closes the thread, so a closed thread
 * sends no request (spec 0014, AC-11, AC-12).
 */
const ReviewCommentsThread = ({ reviewId, onCountChange }: Props) => {
  const t = useTranslations("reviews");
  const {
    comments,
    hasNextPage,
    isLoading,
    hasFailed,
    loadMore,
    isLoadingMore,
    loadMoreFailed,
    retry,
    rememberCreated,
    patchComment,
  } = useReviewComments(reviewId);
  const [focusId, setFocusId] = useState<string | null>(null);

  // A failed read is visible and retryable, and its toast is raised from an
  // effect: never from a render body (AC-11).
  useEffect(() => {
    if (hasFailed) {
      showToast({ title: t("comments.loadFailed"), type: "error" });
    }
  }, [hasFailed, t]);

  const handleCreated = (answer: ReviewCommentWriteAnswer): void => {
    rememberCreated(answer.comment);
    onCountChange(answer.commentCount);
    setFocusId(null);
  };

  const handleDeleted = (answer: ReviewCommentWriteAnswer): void => {
    patchComment(answer.comment);
    onCountChange(answer.commentCount);
    setFocusId(answer.comment.id);
  };

  return (
    <section
      id={`review-${reviewId}-comments`}
      aria-label={t("comments.title")}
      className="flex flex-col gap-3 rounded-lg border border-dashed p-4"
    >
      <h4 className="text-sm font-medium">{t("comments.title")}</h4>

      {hasFailed ? (
        <div role="alert" className="flex flex-col items-start gap-2">
          <p className="text-sm text-destructive">{t("comments.loadFailed")}</p>
          <Button variant="outline" size="sm" onClick={() => void retry()}>
            {t("comments.retry")}
          </Button>
        </div>
      ) : null}

      {!hasFailed && !isLoading && comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("comments.empty")}</p>
      ) : null}

      <ul className="flex flex-col gap-1">
        {comments.map((comment) => (
          <ReviewCommentItem
            key={comment.id}
            reviewId={reviewId}
            comment={comment}
            focusOnMount={focusId === comment.id}
            onDeleted={handleDeleted}
          />
        ))}
      </ul>

      {hasNextPage ? (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => void loadMore()}
          disabled={isLoadingMore}
          aria-busy={isLoadingMore}
        >
          {isLoadingMore ? t("comments.busy") : t("comments.loadMore")}
        </Button>
      ) : null}

      {loadMoreFailed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("comments.loadFailed")}
        </p>
      ) : null}

      <ReviewCommentForm reviewId={reviewId} onCreated={handleCreated} />
    </section>
  );
};

export default ReviewCommentsThread;
