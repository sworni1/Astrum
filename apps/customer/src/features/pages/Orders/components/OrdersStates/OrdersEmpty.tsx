"use client";

import { useTranslations } from "next-intl";
import { EMPTY_COPY, type OrdersEmptyState } from "@/features/pages/Orders/lib/emptyState";

type Props = {
  state: Exclude<OrdersEmptyState, "none">;
  query: string;
};

const OrdersEmpty = ({ state, query }: Props) => {
  const t = useTranslations("orders");
  const copy = EMPTY_COPY[state];

  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-group border border-border bg-card px-7 py-16 text-center">
      <h2 className="text-lg font-semibold">{t(copy.titleKey)}</h2>
      <p className="text-sm text-muted-foreground">
        {state === "noResults"
          ? t(copy.textKey, { query })
          : t(copy.textKey)}
      </p>
    </div>
  );
};

export default OrdersEmpty;
