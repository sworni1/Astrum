"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import FailureBlock from "@/features/general/FailureBlock";
import {
  HEADING,
  HEADING_MUTED,
  HEADING_ROW,
  SCREEN_WRAPPER,
} from "@/features/general/lib/screenStyles";
import SalesPager from "./components/SalesPager";
import SalesEmpty from "./components/SalesStates/SalesEmpty";
import SalesSkeleton from "./components/SalesStates/SalesSkeleton";
import SalesTable from "./components/SalesTable";
import SalesToolbar from "./components/SalesToolbar";
import StatsRow from "./components/StatsRow";
import { useSalesFilters } from "./hooks/useSalesFilters";
import { StateScreen } from "./StateScreen";

export default function SellerOrders() {
  const t = useTranslations("seller");
  const screen = useSalesFilters();
  const page = screen.page;

  if (screen.kind === "notSeller") {
    return (
      <StateScreen
        title={t("states.notSellerTitle")}
        text={t("states.notSellerText")}
        action={
          <Button asChild>
            <Link href="/seller/onboarding">{t("states.notSellerAction")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className={SCREEN_WRAPPER}>
      {screen.firstLoad ? (
        <SalesSkeleton />
      ) : (
        <>
          <div className={HEADING_ROW}>
            <div>
              <h1 className={HEADING}>{t("title")}</h1>
              <p className={HEADING_MUTED}>{t("subtitle")}</p>
            </div>
            {page === undefined ||
            screen.failed ||
            screen.empty !== "none" ? null : (
              <p className={HEADING_MUTED}>
                {t("found", { count: page.total })}
              </p>
            )}
          </div>

          {screen.failed && page === undefined ? null : (
            <StatsRow counts={screen.counts} stats={screen.stats} />
          )}

          <SalesToolbar
            status={screen.status}
            counts={screen.counts}
            onSelect={screen.selectStatus}
            query={screen.inputValue}
            queryIsBusy={screen.isValidating}
            onQueryChange={screen.setInputValue}
          />

          {screen.failed ? (
            <FailureBlock
              title={t("states.failureTitle")}
              text={t("states.failureText")}
              retryLabel={t("retry")}
              onRetry={screen.retry}
            />
          ) : page === undefined ? null : screen.empty !== "none" ? (
            <SalesEmpty state={screen.empty} query={screen.debouncedQuery} />
          ) : (
            <>
              <SalesTable items={page.items} />
              <SalesPager
                page={page.page}
                totalPages={page.totalPages}
                onBack={() => screen.setPageNumber(page.page - 1)}
                onNext={() => screen.setPageNumber(page.page + 1)}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
