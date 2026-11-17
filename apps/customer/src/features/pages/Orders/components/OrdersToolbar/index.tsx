"use client";

import { useTranslations } from "next-intl";
import type { OrderListPage, OrderListStatus } from "@/common/types/order.types";
import { Skeleton } from "@/components/ui/skeleton";
import FilterTabs, { type FilterTabItem } from "@/features/general/FilterTabs";
import SearchField from "@/features/general/SearchField";
import { TOOLBAR } from "@/features/general/lib/screenStyles";
import { ORDER_TABS } from "@/features/pages/Orders/lib/tabs";

type Props = {
  status: OrderListStatus;
  counts?: OrderListPage["counts"];
  onSelect: (status: OrderListStatus) => void;
  query: string;
  queryIsBusy: boolean;
  onQueryChange: (value: string) => void;
};

/** The three tabs and the search, both read from the shared blocks (spec 0026, AC-13). */
const OrdersToolbar = ({
  status,
  counts,
  onSelect,
  query,
  queryIsBusy,
  onQueryChange,
}: Props) => {
  const t = useTranslations("orders");

  const tabs: FilterTabItem[] = ORDER_TABS.map((tab) => ({
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
        onChange={(id) => onSelect(id as OrderListStatus)}
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

export default OrdersToolbar;
