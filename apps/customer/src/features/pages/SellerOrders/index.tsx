"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSellerOrders } from "@/hooks/seller/useSellerOrders";
import { SELLER_COLUMN_ALIGNMENT, SELLER_COLUMNS } from "./lib/columns";
import SellerOrderBand from "./SellerOrderBand";
import SellerOrderRow from "./SellerOrderRow";
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

/**
 * The seller panel is one read only table: a band of order facts, then one row
 * per line, and no control that sends a request (spec 0020, AC-1 to AC-8).
 */
export default function SellerOrders() {
  const t = useTranslations("seller");
  const [page, setPage] = useState(1);
  const { data, kind, isLoading, isValidating, mutate } = useSellerOrders(page);

  useEffect(() => {
    if (!data || data.total === 0 || data.orders.length > 0) {
      return;
    }

    if (data.totalPages > 0 && data.totalPages !== page) {
      setPage(data.totalPages);
    }
  }, [data, page]);

  if (kind === "notSeller") {
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

  if (kind === "failure") {
    return (
      <StateScreen
        title={t("states.failureTitle")}
        text={t("states.failureText")}
        action={<Button onClick={() => void mutate()}>{t("retry")}</Button>}
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

      <div className="relative" aria-busy={isValidating}>
        {isValidating && (
          <div
            className="absolute inset-x-0 top-0 z-20 h-0.5 animate-pulse bg-primary"
            aria-hidden="true"
          />
        )}

        <table aria-label={t("title")} className="w-full text-sm">
          <thead className="hidden sm:table-header-group">
            <tr>
              {SELLER_COLUMNS.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className={`sticky top-16 z-10 border-b bg-background px-3 py-2 text-xs font-medium text-muted-foreground ${SELLER_COLUMN_ALIGNMENT[column] ?? "text-left"}`}
                >
                  {t(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="block sm:table-row-group">
            {data.orders.map((order) => (
              <Fragment key={order.id}>
                <SellerOrderBand order={order} />
                {order.orderItems.map((line) => (
                  <SellerOrderRow
                    key={line.id}
                    line={line}
                    createdAt={order.createdAt}
                  />
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
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
