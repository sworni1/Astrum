"use client";

import { useTranslations } from "next-intl";
import type { ReviewState } from "@/common/types/review.types";
import { ReviewStateStatus } from "@/common/types/review.types";
import WriteReviewDialog from "@/features/pages/ProductOverview/Reviews/components/WriteReviewDialog";

type Props = {
  productId: string;
  reviewState: ReviewState | null;
};

/**
 * The write control exists only for a delivered, unreviewed line; the other two
 * states explain themselves, and a state the client does not know renders
 * nothing rather than a wrong explanation (AC-7).
 */
const ReviewWriteAction = ({ productId, reviewState }: Props) => {
  const t = useTranslations("reviews");

  if (!reviewState) {
    return null;
  }

  if (
    reviewState.status === ReviewStateStatus.ELIGIBLE &&
    reviewState.orderItemId
  ) {
    return (
      <WriteReviewDialog
        productId={productId}
        orderItemId={reviewState.orderItemId}
      />
    );
  }

  if (reviewState.status === ReviewStateStatus.NOT_PURCHASED) {
    return (
      <p className="text-sm text-muted-foreground">{t("onlyAfterDelivery")}</p>
    );
  }

  if (reviewState.status === ReviewStateStatus.ALREADY_REVIEWED) {
    return (
      <p className="text-sm text-muted-foreground">{t("alreadyReviewed")}</p>
    );
  }

  return null;
};

export default ReviewWriteAction;
