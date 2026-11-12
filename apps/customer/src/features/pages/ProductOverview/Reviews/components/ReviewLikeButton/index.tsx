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

/**
 * The like control: one toggle whose accessible name is the action, so a screen
 * reader reads `reviews.like` while unpressed and `reviews.unlike` while
 * pressed. The number sits beside it as `aria-hidden` text, so a count is never
 * glued onto the name (spec 0014, AC-1, AC-6).
 */
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
