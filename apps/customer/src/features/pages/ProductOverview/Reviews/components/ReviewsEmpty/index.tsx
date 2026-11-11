"use client";

import { useTranslations } from "next-intl";

/** The honest empty state: no invented card stands in for a review (AC-6). */
const ReviewsEmpty = () => {
  const t = useTranslations("reviews");

  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <p className="font-medium">{t("emptyTitle")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t("emptyText")}</p>
    </div>
  );
};

export default ReviewsEmpty;
