"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
};

/**
 * Four of these make the dialog: native radios inside a fieldset, so a keyboard
 * tabs into the group and the arrows move the pick (AC-8).
 */
const StarRadioGroup = ({ name, label, value, onChange }: Props) => {
  const t = useTranslations("reviews");

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <label
            key={`${name}-${star}`}
            className="cursor-pointer rounded-md p-1 focus-within:ring-2 focus-within:ring-ring/50"
          >
            <input
              type="radio"
              name={name}
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              className="sr-only"
            />
            <span className="sr-only">{t("rate", { star })}</span>
            <Star
              aria-hidden
              className={cn(
                "size-6 transition-colors",
                star <= value
                  ? "fill-foreground text-foreground"
                  : "fill-transparent text-muted-foreground",
              )}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export default StarRadioGroup;
