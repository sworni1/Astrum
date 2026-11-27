"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

const GuestCartNotice = () => {
  const t = useTranslations("cart");

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm">
      <p className="text-muted-foreground">{t("guestNotice")}</p>
      <Link
        href="/auth/signin?next=/checkout"
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t("guestSignIn")}
      </Link>
    </div>
  );
};

export default GuestCartNotice;
