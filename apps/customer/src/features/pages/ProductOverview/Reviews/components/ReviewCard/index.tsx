"use client";

import { MessageCircle, ThumbsUp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ProductReview } from "@/common/types/review.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ReviewPhotos from "@/features/pages/ProductOverview/Reviews/components/ReviewPhotos";
import StarRating from "@/features/pages/ProductOverview/Reviews/components/StarRating";

type Props = {
  review: ProductReview;
};

/**
 * One published review: author, stars, date, the detail ratings the form asked
 * for, the photos it carried, and the two controls whose feature has not landed
 * yet, visibly disabled and with no number beside them (AC-2).
 */
const ReviewCard = ({ review }: Props) => {
  const t = useTranslations("reviews");
  const format = useFormatter();

  const details = [
    { key: "quality", label: t("ratingQuality"), value: review.qualityRating },
    { key: "delivery", label: t("ratingDelivery"), value: review.deliveryRating },
    { key: "accuracy", label: t("ratingAccuracy"), value: review.accuracyRating },
  ];

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
            <Button
              variant="ghost"
              size="sm"
              aria-disabled="true"
              title={t("comingSoon")}
              className="h-8 px-3 text-xs text-muted-foreground"
            >
              <ThumbsUp aria-hidden className="size-4" />
              <span className="sr-only">{t("like")}</span>
              <span className="sr-only">{t("comingSoon")}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-disabled="true"
              title={t("comingSoon")}
              className="h-8 px-3 text-xs text-muted-foreground"
            >
              <MessageCircle aria-hidden className="size-4" />
              <span className="sr-only">{t("viewComments")}</span>
              <span className="sr-only">{t("comingSoon")}</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReviewCard;
