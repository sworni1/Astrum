"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SellerOrderLine } from "../../../common/types/order.types";
import { useSellerOrders } from "../../../hooks/seller";
import { useUser } from "../../../hooks/user";
import { SELLER_GRID_CLASS } from "./grid";
import { pageWithLine } from "./pageData";
import SellerOrderGroup from "./SellerOrderGroup";
import { StateScreen } from "./StateScreen";

const SkeletonPanel = () => {
  const t = useTranslations("seller");

  return (
    <div
      className="mx-auto max-w-screen-xl space-y-3 p-4 md:p-6"
      aria-label={t("states.loadingLabel")}
    >
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
};

export default function SellerOrders() {
  const t = useTranslations("seller");
  const [page, setPage] = useState(1);
  const { data, kind, isLoading, isValidating, mutate } = useSellerOrders(page);
  const { profileData } = useUser();
  const actionsDisabled = profileData?.status === "PENDING";

  useEffect(() => {
    if (!data || data.total === 0 || data.orders.length > 0) {
      return;
    }

    if (data.totalPages > 0 && data.totalPages !== page) {
      setPage(data.totalPages);
    }
  }, [data, page]);

  const applyLine = async (line: SellerOrderLine): Promise<void> => {
    await mutate(
      (current) => (current ? pageWithLine(current, line) : undefined),
      false,
    );
    await mutate();
  };

  const reload = async (): Promise<void> => {
    await mutate();
  };

  if (kind === "notSeller") {
    return (
      <StateScreen
        title={t("states.notSellerTitle")}
        text={t("states.notSellerText")}
      />
    );
  }

  if (kind === "disabled") {
    return (
      <StateScreen
        title={t("states.disabledTitle")}
        text={t("states.disabledText")}
      />
    );
  }

  if (kind === "failure") {
    return (
      <StateScreen
        title={t("states.failureTitle")}
        text={t("states.failureText")}
        action={<Button onClick={() => void reload()}>{t("retry")}</Button>}
      />
    );
  }

  if (isLoading && !data) {
    return <SkeletonPanel />;
  }

  if (!data || data.total === 0) {
    return (
      <StateScreen
        title={t("states.emptyTitle")}
        text={t("states.emptyText")}
      />
    );
  }

  const shownPage = data.page;

  return (
    <div className="mx-auto max-w-screen-xl p-4 md:p-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("found", { count: data.total })}
        </p>
      </header>

      {actionsDisabled && (
        <div
          role="status"
          className="mb-3 rounded-lg border border-dashed px-3 py-2 text-sm"
        >
          <p className="font-medium">{t("states.pendingTitle")}</p>
          <p className="text-muted-foreground">{t("states.pendingText")}</p>
        </div>
      )}

      <div className="relative" aria-busy={isValidating}>
        {isValidating && (
          <div
            className="absolute inset-x-0 top-0 z-20 h-0.5 animate-pulse bg-primary"
            aria-hidden="true"
          />
        )}

        <div
          aria-hidden="true"
          className={`${SELLER_GRID_CLASS} sticky top-16 z-10 hidden border-b bg-background/95 px-3 py-2 text-xs font-medium text-muted-foreground backdrop-blur sm:grid`}
        >
          <span>{t("columns.product")}</span>
          <span className="text-right">{t("columns.quantity")}</span>
          <span className="text-right">{t("columns.unitPrice")}</span>
          <span className="text-right">{t("columns.subtotal")}</span>
          <span>{t("columns.status")}</span>
          <span className="text-right">{t("columns.actions")}</span>
        </div>

        <div className="space-y-3">
          {data.orders.map((order) => (
            <SellerOrderGroup
              key={order.id}
              order={order}
              actionsDisabled={actionsDisabled}
              onUpdated={applyLine}
              onRefused={reload}
            />
          ))}
        </div>
      </div>

      <nav
        aria-label={t("pagination.label")}
        className="mt-4 flex flex-wrap items-center justify-end gap-2"
      >
        <Button
          variant="outline"
          disabled={shownPage <= 1}
          onClick={() => setPage(shownPage - 1)}
        >
          {t("pagination.back")}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t("pagination.pageOf", {
            page: shownPage,
            totalPages: data.totalPages,
          })}
        </span>
        <Button
          variant="outline"
          disabled={shownPage >= data.totalPages}
          onClick={() => setPage(shownPage + 1)}
        >
          {t("pagination.next")}
        </Button>
      </nav>
    </div>
  );
}
