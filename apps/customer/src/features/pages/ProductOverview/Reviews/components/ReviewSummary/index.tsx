"use client";

import { useTranslations } from "next-intl";
import type { ReviewAggregate } from "@/common/types/review.types";
import { distributionRows, formatAverageRating } from "@/features/pages/ProductOverview/Reviews/lib/distribution";
import StarRating from "@/features/pages/ProductOverview/Reviews/components/StarRating";

type Props = {
  aggregate: ReviewAggregate;
};

/** Average, total and the five shares; nothing at all when nothing is rated. */
const ReviewSummary = ({ aggregate }: Props) => {
  const t = useTranslations("reviews");

  if (aggregate.total === 0) {
    return null;
  }

  const rows = distributionRows(aggregate.distribution, aggregate.total);

  return (
    <div className="grid gap-6 rounded-lg border p-4 sm:grid-cols-[auto_1fr] sm:items-center">
      <div className="flex flex-col items-center gap-1">
        <span className="text-4xl font-bold">
          {formatAverageRating(aggregate.averageRating)}
        </span>
        <StarRating value={Math.round(aggregate.averageRating)} />
        <span className="text-sm text-muted-foreground">
          {t("count", { count: aggregate.total })}
        </span>
      </div>

      <dl aria-label={t("distributionLabel")} className="flex flex-col gap-1">
        {rows.map((row) => (
          <div
            key={`share-${row.star}`}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-sm"
          >
            <dt className="text-muted-foreground">{row.star}★</dt>
            <div className="h-2 overflow-hidden rounded bg-muted">
              <div
                className="h-full rounded bg-primary"
                style={{ width: `${row.share}%` }}
              />
            </div>
            <dd className="w-10 text-end text-muted-foreground">{row.share}%</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default ReviewSummary;
