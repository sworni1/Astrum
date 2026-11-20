"use client";

import { useTranslations } from "next-intl";
import FailureBlock from "@/features/general/FailureBlock";
import {
  HEADING,
  HEADING_MUTED,
  HEADING_ROW,
  SCREEN_WRAPPER,
} from "@/features/general/lib/screenStyles";
import OrderGroup from "./components/OrderGroup";
import OrdersToolbar from "./components/OrdersToolbar";
import OrdersEmpty from "./components/OrdersStates/OrdersEmpty";
import OrdersSkeleton from "./components/OrdersStates/OrdersSkeleton";
import StatsRow from "./components/StatsRow";
import { useOrdersScreen } from "./hooks/useOrdersScreen";

export default function Orders() {
  const t = useTranslations("orders");
  const screen = useOrdersScreen();

  return (
    <div className={SCREEN_WRAPPER}>
      <div className={HEADING_ROW}>
        <h1 className={HEADING}>{t("title")}</h1>
        {screen.page === undefined ? null : (
          <p className={HEADING_MUTED}>
            {t("found", { count: screen.page.items.length })}
          </p>
        )}
      </div>

      {screen.firstLoad ? (
        <OrdersSkeleton />
      ) : (
        <StatsRow counts={screen.page?.counts} spent={screen.page?.spent} />
      )}

      <OrdersToolbar
        status={screen.status}
        counts={screen.page?.counts}
        onSelect={screen.selectStatus}
        query={screen.inputValue}
        queryIsBusy={screen.isValidating}
        onQueryChange={screen.setInputValue}
      />

      {screen.failed ? (
        <FailureBlock
          title={t("failed")}
          retryLabel={t("retry")}
          onRetry={screen.retry}
        />
      ) : screen.empty === "none" ? (
        <>
          {screen.page?.items.map((order) => (
            <OrderGroup key={order.id} order={order} />
          ))}
        </>
      ) : (
        <OrdersEmpty state={screen.empty} query={screen.debouncedQuery} />
      )}
    </div>
  );
}
