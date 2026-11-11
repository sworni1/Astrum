"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
};

/** The read only stars of a card or a summary; the number lives in the label. */
const StarRating = ({ value }: Props) => {
  const t = useTranslations("reviews");

  return (
    <div
      className="flex"
      role="img"
      aria-label={t("ratedOutOf", { rating: value })}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={`rated-${star}`}
          aria-hidden
          className={cn(
            "size-4",
            star <= value
              ? "fill-foreground text-foreground"
              : "fill-transparent text-muted-foreground",
          )}
        />
      ))}
    </div>
  );
};

export default StarRating;
