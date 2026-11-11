"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/common/actions/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Locale, locales } from "@/i18n/config";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

/**
 * A cookie written by a server action does not repaint the screen already on
 * display, so the refresh after the action is what makes the switch visible.
 */
export default function LocaleSwitcher({ className }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("common");
  const [isPending, startTransition] = useTransition();

  const change = (next: string) => {
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  };

  return (
    <Select value={locale} onValueChange={change} disabled={isPending}>
      <SelectTrigger
        aria-label={t("language")}
        className={cn("cursor-pointer", isPending && "opacity-60", className)}
      >
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        {locales.map((value: Locale) => (
          <SelectItem key={value} value={value}>
            {t(value === "en" ? "english" : "russian")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
