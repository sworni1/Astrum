"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { showToast } from "@/common/helpers/showToast";
import { Button } from "@/components/ui/button";

type Props = {
  onRetry: () => void;
};

const ReviewsError = ({ onRetry }: Props) => {
  const t = useTranslations("reviews");

  useEffect(() => {
    showToast({ title: t("loadFailed"), type: "error" });
  }, [t]);

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6"
    >
      <p className="font-medium">{t("loadFailed")}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  );
};

export default ReviewsError;
