"use client";

import { MessageCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { showToast } from "@/common/helpers/showToast";
import type { ProductReview } from "@/common/types/review.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ReviewCommentsThread from "@/features/pages/ProductOverview/Reviews/components/ReviewCommentsThread";
import ReviewLikeButton from "@/features/pages/ProductOverview/Reviews/components/ReviewLikeButton";
import ReviewPhotos from "@/features/pages/ProductOverview/Reviews/components/ReviewPhotos";
import StarRating from "@/features/pages/ProductOverview/Reviews/components/StarRating";
import type { ReviewCounts } from "@/features/pages/ProductOverview/Reviews/hooks/useReviewCounts";
import { classifyReviewRefusal } from "@/features/pages/ProductOverview/Reviews/lib/refusal";
import { browserTimeZone } from "@/features/pages/SellerOrders/lib/format";
import type { ReviewLikes } from "@/hooks/review/useReviewLikes";

type Props = {
  review: ProductReview;
  counts: ReviewCounts;
  likes: ReviewLikes;
};

const ReviewCard = ({ review, counts, likes }: Props) => {
  const t = useTranslations("reviews");
  const format = useFormatter();
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  const liked = likes.isLiked(review.id);
  const isLikePending = likes.isPending(review.id);
  const likeCount = counts.likeCountOf(review.id, review.likeCount);
  const commentCount = counts.commentCountOf(review.id, review.commentCount);
  const threadId = `review-${review.id}-comments`;

  const details = [
    { key: "quality", label: t("ratingQuality"), value: review.qualityRating },
    {
      key: "delivery",
      label: t("ratingDelivery"),
      value: review.deliveryRating,
    },
    {
      key: "accuracy",
      label: t("ratingAccuracy"),
      value: review.accuracyRating,
    },
  ];

  const toggleLike = async (): Promise<void> => {
    if (isLikePending) {
      return;
    }

    const before = likeCount;
    counts.setLikeCount(review.id, liked ? before - 1 : before + 1);

    try {
      const answer = await likes.toggle(review.id);

      if (!answer) {
        counts.setLikeCount(review.id, before);
        return;
      }

      counts.setLikeCount(review.id, answer.likeCount);
    } catch (error) {
      counts.setLikeCount(review.id, before);

      if (classifyReviewRefusal(error) !== "emailNotConfirmed") {
        showToast({ title: t("likeFailed"), type: "error" });
      }
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">
              {review.authorName ?? t("anonymousBuyer")}
            </h3>
            <span aria-hidden className="text-muted-foreground">
              •
            </span>
            <StarRating value={review.rating} />
            <span aria-hidden className="text-muted-foreground">
              •
            </span>
            <time
              dateTime={new Date(review.createdAt).toISOString().split("T")[0]}
              className="text-sm text-muted-foreground"
            >
              {format.dateTime(new Date(review.createdAt), {
                dateStyle: "long",
                timeZone: browserTimeZone(),
              })}
            </time>
          </div>

          <p className="text-muted-foreground">{review.comment}</p>

          {review.photos.length > 0 ? (
            <ReviewPhotos reviewId={review.id} photos={review.photos} />
          ) : null}

          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {details.map((detail) => (
              <div key={detail.key} className="flex gap-1">
                <dt>{detail.label}</dt>
                <dd>{detail.value}/5</dd>
              </div>
            ))}
          </dl>

          <div className="flex gap-2">
            <ReviewLikeButton
              liked={liked}
              count={likeCount}
              isPending={isLikePending}
              onToggle={() => void toggleLike()}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={isCommentsOpen}
              aria-controls={threadId}
              aria-label={t("comments.open")}
              onClick={() => setIsCommentsOpen((open) => !open)}
              className="h-8 gap-1 px-3 text-xs text-muted-foreground"
            >
              <MessageCircle aria-hidden className="size-4" />
              <span aria-hidden="true">{commentCount}</span>
            </Button>
          </div>

          {isCommentsOpen ? (
            <ReviewCommentsThread
              reviewId={review.id}
              onCountChange={(next) => counts.setCommentCount(review.id, next)}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

export default ReviewCard;
