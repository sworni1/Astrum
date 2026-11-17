"use client";

import { useTranslations } from "next-intl";
import type {
  SellerLineCounts,
  SellerListStatus,
} from "@/common/types/order.types";
import { Skeleton } from "@/components/ui/skeleton";
import FilterTabs, { type FilterTabItem } from "@/features/general/FilterTabs";
import SearchField from "@/features/general/SearchField";
import { TOOLBAR } from "@/features/general/lib/screenStyles";
import { SELLER_TABS } from "@/features/pages/SellerOrders/lib/status";

type Props = {
  status: SellerListStatus;
  counts?: SellerLineCounts;
  onSelect: (status: SellerListStatus) => void;
  query: string;
  queryIsBusy: boolean;
  onQueryChange: (value: string) => void;
};

/** The three tabs with their counts and the search field (spec 0026, AC-7, AC-8). */
const SalesToolbar = ({
  status,
  counts,
  onSelect,
  query,
  queryIsBusy,
  onQueryChange,
}: Props) => {
  const t = useTranslations("seller");

  const tabs: FilterTabItem[] = SELLER_TABS.map((tab) => ({
    id: tab.id,
    label:
      counts === undefined ? (
        <Skeleton className="h-4 w-16" />
      ) : (
        t(tab.labelKey, { count: counts[tab.countKey] })
      ),
  }));

  return (
    <div className={TOOLBAR}>
      <FilterTabs
        items={tabs}
        currentId={status}
        onChange={(id) => onSelect(id as SellerListStatus)}
        label={t("tabs.label")}
      />
      <SearchField
        value={query}
        busy={queryIsBusy}
        placeholder={t("search.placeholder")}
        label={t("search.label")}
        onChange={onQueryChange}
      />
    </div>
  );
};

export default SalesToolbar;
