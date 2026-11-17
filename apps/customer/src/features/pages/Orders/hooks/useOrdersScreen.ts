"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { showLoadFailureOnce } from "@/common/helpers/showLoadFailureOnce";
import type { OrderListPage, OrderListStatus } from "@/common/types/order.types";
import { useGetOrders } from "@/hooks/order/useGetOrders";
import { type OrdersEmptyState, ordersEmptyState } from "@/features/pages/Orders/lib/emptyState";
import { countForStatus } from "@/features/pages/Orders/lib/tabs";
import { useOrderSearch } from "./useOrderSearch";

export interface UseOrdersScreenReturn {
  status: OrderListStatus;
  selectStatus: (status: OrderListStatus) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  debouncedQuery: string;
  page: OrderListPage | undefined;
  isLoading: boolean;
  isValidating: boolean;
  firstLoad: boolean;
  failed: boolean;
  empty: OrdersEmptyState;
  retry: () => void;
}

/**
 * The screen's own state: the chosen tab, the settled query, the read and the
 * one verdict about which empty state applies. The tab and the query are
 * component state, not URL state, so a refresh returns to «Все» (spec 0025,
 * AC-8, AC-9, AC-12, AC-13).
 */
export const useOrdersScreen = (): UseOrdersScreenReturn => {
  const t = useTranslations("orders");
  const [status, setStatus] = useState<OrderListStatus>("ALL");
  const { inputValue, debouncedQuery, setInputValue } = useOrderSearch();
  const { page, isLoading, isValidating, error, mutate } = useGetOrders({
    status,
    q: debouncedQuery,
  });

  // One toast per failed read, raised from an effect and never from the render
  // body (storefront rule S4). The helper holds the identity of the error, so a
  // re-render, a second consumer of the same key or a changed translator
  // identity raises nothing new (spec 0025, AC-13).
  useEffect(() => {
    showLoadFailureOnce(error, t("failed"));
  }, [error, t]);

  const failed = error !== null;
  const firstLoad = isLoading && page === undefined;

  const decided = ordersEmptyState({
    itemCount: page?.items.length ?? 0,
    allCount: page?.counts.all ?? 0,
    tabCount: page === undefined ? 0 : countForStatus(page.counts, status),
    query: debouncedQuery,
    isValidating,
  });

  return {
    status,
    selectStatus: setStatus,
    inputValue,
    setInputValue,
    debouncedQuery,
    page,
    isLoading,
    isValidating,
    firstLoad,
    failed,
    // A failed read renders no empty state at all; its own block owns the screen.
    empty: failed ? "none" : decided,
    retry: () => {
      void mutate();
    },
  };
};
