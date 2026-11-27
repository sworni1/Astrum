"use client";

import { ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  liked: boolean;
  count: number;
  isPending: boolean;
  onToggle: () => void;
};

const ReviewLikeButton = ({ liked, count, isPending, onToggle }: Props) => {
  const t = useTranslations("reviews");

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={liked}
      aria-busy={isPending}
      aria-label={liked ? t("unlike") : t("like")}
      onClick={onToggle}
      className={cn(
        "h-8 gap-1 px-3 text-xs",
        liked ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <ThumbsUp aria-hidden className="size-4" />
      <span aria-hidden="true">{count}</span>
    </Button>
  );
};

export default ReviewLikeButton;
