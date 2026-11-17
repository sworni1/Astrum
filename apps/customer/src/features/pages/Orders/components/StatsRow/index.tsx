"use client";

import { useLocale, useTranslations } from "next-intl";
import type { OrderListPage } from "@/common/types/order.types";
import StatTile from "@/features/general/StatTile";
import { amountListText } from "@/features/general/lib/moneyText";
import { STAT_GRID } from "@/features/general/lib/screenStyles";

type Props = {
  counts?: OrderListPage["counts"];
  spent?: OrderListPage["spent"];
};

const countOf = (value: number | undefined): string | undefined =>
  value === undefined ? undefined : String(value);

const StatsRow = ({ counts, spent }: Props) => {
  const t = useTranslations("orders");
  const locale = useLocale();

  return (
    <div className={STAT_GRID}>
      <StatTile label={t("stats.orders")} value={countOf(counts?.all)} />
      <StatTile
        label={t("stats.spent")}
        value={spent === undefined ? undefined : amountListText(spent, locale)}
      />
      <StatTile label={t("stats.received")} value={countOf(counts?.delivered)} />
    </div>
  );
};

export default StatsRow;
