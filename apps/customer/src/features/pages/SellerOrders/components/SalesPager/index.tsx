"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = {
  page: number;
  totalPages: number;
  onBack: () => void;
  onNext: () => void;
};

/**
 * The pager slices lines, not orders, and is disabled at both ends of the range
 * (spec 0026, AC-10).
 */
const SalesPager = ({ page, totalPages, onBack, onNext }: Props) => {
  const t = useTranslations("seller");

  return (
    <nav
      aria-label={t("pagination.label")}
      className="flex flex-wrap items-center justify-end gap-2"
    >
      <Button variant="outline" disabled={page <= 1} onClick={onBack}>
        {t("pagination.back")}
      </Button>
      <span className="text-sm text-muted-foreground">
        {t("pagination.pageOf", { page, totalPages })}
      </span>
      <Button variant="outline" disabled={page >= totalPages} onClick={onNext}>
        {t("pagination.next")}
      </Button>
    </nav>
  );
};

export default SalesPager;
