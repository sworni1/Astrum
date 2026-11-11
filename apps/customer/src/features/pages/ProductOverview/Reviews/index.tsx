"use client";

import { useTranslations } from "next-intl";
import type { ReviewState } from "@/common/types/review.types";
import { useProductReviews } from "@/hooks/review/useProductReviews";
import LoadMoreReviews from "./components/LoadMoreReviews";
import ReviewCard from "./components/ReviewCard";
import ReviewsEmpty from "./components/ReviewsEmpty";
import ReviewsError from "./components/ReviewsError";
import ReviewSummary from "./components/ReviewSummary";
import ReviewWriteAction from "./components/ReviewWriteAction";

type Props = {
  productId: string;
  reviewState: ReviewState | null;
};

const Reviews = ({ productId, reviewState }: Props) => {
  const t = useTranslations("reviews");
  const {
    reviews,
    aggregate,
    reviewsAreLoading,
    reviewError,
    hasNextPage,
    loadMore,
    isLoadingMore,
    loadMoreFailed,
    retry,
  } = useProductReviews(productId);

  const showsEmptyState =
    !reviewsAreLoading && !reviewError && reviews.length === 0;

  return (
    <section
      id="reviews"
      className="mx-auto w-full max-w-7xl scroll-mt-24 px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold">{t("title")}</h2>
        <ReviewWriteAction productId={productId} reviewState={reviewState} />
      </div>

      {reviewError ? (
        <ReviewsError onRetry={retry} />
      ) : (
        <div className="flex flex-col gap-6">
          {aggregate ? <ReviewSummary aggregate={aggregate} /> : null}

          {showsEmptyState ? (
            <ReviewsEmpty />
          ) : (
            <div className="flex flex-col gap-4">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}

          <LoadMoreReviews
            hasNextPage={hasNextPage}
            isLoadingMore={isLoadingMore}
            loadMoreFailed={loadMoreFailed}
            onLoadMore={loadMore}
          />
        </div>
      )}
    </section>
  );
};

export default Reviews;
