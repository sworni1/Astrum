"use client";

import { useTranslations } from "next-intl";
import {
  SALES_EMPTY_COPY,
  type SalesEmptyState,
} from "@/features/pages/SellerOrders/lib/emptyState";

type Props = {
  state: Exclude<SalesEmptyState, "none">;
  query: string;
};

const SalesEmpty = ({ state, query }: Props) => {
  const t = useTranslations("seller");
  const copy = SALES_EMPTY_COPY[state];

  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card px-7 py-16 text-center">
      <h2 className="text-lg font-semibold">{t(copy.titleKey)}</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {state === "noResults" ? t(copy.textKey, { query }) : t(copy.textKey)}
      </p>
    </div>
  );
};

export default SalesEmpty;
