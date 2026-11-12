"use client";

import { Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { showToast } from "@/common/helpers/showToast";
import type {
  ReviewComment,
  ReviewCommentWriteAnswer,
} from "@/common/types/review.types";
import { Button } from "@/components/ui/button";
import DeleteReviewCommentDialog from "@/features/pages/ProductOverview/Reviews/components/DeleteReviewCommentDialog";
import { useDeleteReviewComment } from "@/hooks/review/useDeleteReviewComment";

type Props = {
  reviewId: string;
  comment: ReviewComment;
  /** True right after a delete, so the stub takes the focus back (AC-11). */
  focusOnMount: boolean;
  onDeleted: (answer: ReviewCommentWriteAnswer) => void;
};

/**
 * One row of the thread. A deleted row prints the stub copy with no author and
 * no control, and only the author's own live row carries the delete control,
 * which opens the project's `AlertDialog` (spec 0014, AC-10, AC-11).
 */
const ReviewCommentItem = ({
  reviewId,
  comment,
  focusOnMount,
  onDeleted,
}: Props) => {
  const t = useTranslations("reviews");
  const format = useFormatter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const justDeleted = useRef(false);

  const { deleteCommentTrigger, isDeletingComment } = useDeleteReviewComment(
    reviewId,
    comment.id,
  );

  const isDeleted = comment.deletedAt !== null;

  useEffect(() => {
    if (focusOnMount) {
      rowRef.current?.focus();
    }
  }, [focusOnMount]);

  const confirmDelete = async (): Promise<void> => {
    try {
      const answer = await deleteCommentTrigger();
      justDeleted.current = true;
      onDeleted(answer);
    } catch {
      showToast({ title: t("comments.deleteFailed"), type: "error" });
    } finally {
      setIsConfirmOpen(false);
    }
  };

  /**
   * Radix would hand focus back to the trigger, which the stub replaced. After
   * a delete the stub takes it through `focusOnMount`; otherwise the control
   * the customer opened stays focused.
   */
  const handleClosed = (): void => {
    if (justDeleted.current) {
      justDeleted.current = false;
      return;
    }

    deleteRef.current?.focus();
  };

  return (
    <li
      ref={rowRef}
      tabIndex={-1}
      className="flex flex-col gap-1 rounded-md px-1 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {isDeleted ? (
        <p className="text-sm italic text-muted-foreground">
          {t("comments.deleted")}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {comment.authorName ?? t("anonymousBuyer")}
            </span>
            <span aria-hidden className="text-muted-foreground">
              •
            </span>
            <time
              dateTime={new Date(comment.createdAt).toISOString()}
              className="text-xs text-muted-foreground"
            >
              {format.dateTime(new Date(comment.createdAt), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </time>
          </div>

          <p className="text-sm">{comment.body}</p>

          {comment.mine ? (
            <Button
              ref={deleteRef}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsConfirmOpen(true)}
              className="h-7 self-start px-2 text-xs text-muted-foreground"
            >
              <Trash2 aria-hidden className="size-3.5" />
              {t("comments.delete")}
            </Button>
          ) : null}
        </>
      )}

      <DeleteReviewCommentDialog
        isOpen={isConfirmOpen}
        isDeleting={isDeletingComment}
        onOpenChange={setIsConfirmOpen}
        onConfirm={() => void confirmDelete()}
        onClosed={handleClosed}
      />
    </li>
  );
};

export default ReviewCommentItem;
