"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { setLocale } from "../common/actions/locale";
import { locales, type Locale } from "../i18n/config";

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
    <select
      aria-label={t("language")}
      value={locale}
      disabled={isPending}
      onChange={(event) => change(event.target.value)}
      className={cn(
        "h-8 cursor-pointer rounded-md border border-border bg-background px-2 text-sm text-foreground",
        isPending && "opacity-60",
        className,
      )}
    >
      {locales.map((value: Locale) => (
        <option key={value} value={value}>
          {t(value === "en" ? "english" : "russian")}
        </option>
      ))}
    </select>
  );
}
