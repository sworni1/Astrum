"use client";

import { useLocale, useTranslations } from "next-intl";
import type {
  SellerLineCounts,
  SellerSalesStats,
} from "@/common/types/order.types";
import StatTile from "@/features/general/StatTile";
import { STAT_GRID } from "@/features/general/lib/screenStyles";
import { amountListText } from "@/features/general/lib/moneyText";

type Props = {
  counts?: SellerLineCounts;
  stats?: SellerSalesStats;
};

const countOf = (value: number | undefined): string | undefined =>
  value === undefined ? undefined : String(value);

/** The four tiles of the mockup, in its own order, none of them a control (AC-6). */
const StatsRow = ({ counts, stats }: Props) => {
  const t = useTranslations("seller");
  const locale = useLocale();

  return (
    <div className={STAT_GRID}>
      <StatTile
        label={t("stats.revenue")}
        value={stats === undefined ? undefined : amountListText(stats.revenue, locale)}
      />
      <StatTile label={t("stats.units")} value={countOf(stats?.units)} />
      <StatTile label={t("stats.delivered")} value={countOf(counts?.delivered)} />
      <StatTile label={t("stats.canceled")} value={countOf(counts?.canceled)} />
    </div>
  );
};

export default StatsRow;
