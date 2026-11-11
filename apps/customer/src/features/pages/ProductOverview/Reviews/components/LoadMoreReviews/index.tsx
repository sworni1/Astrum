"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = {
  hasNextPage: boolean;
  isLoadingMore: boolean;
  loadMoreFailed: boolean;
  onLoadMore: () => void;
};

/** The paging control: one page at a time, and it disappears on the last one. */
const LoadMoreReviews = ({
  hasNextPage,
  isLoadingMore,
  loadMoreFailed,
  onLoadMore,
}: Props) => {
  const t = useTranslations("reviews");

  return (
    <div className="flex flex-col items-center gap-2">
      {hasNextPage ? (
        <Button
          variant="outline"
          onClick={onLoadMore}
          disabled={isLoadingMore}
          aria-busy={isLoadingMore}
        >
          {isLoadingMore ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" />
              {t("busy")}
            </>
          ) : (
            t("loadMore")
          )}
        </Button>
      ) : null}
      {loadMoreFailed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("loadFailed")}
        </p>
      ) : null}
    </div>
  );
};

export default LoadMoreReviews;
