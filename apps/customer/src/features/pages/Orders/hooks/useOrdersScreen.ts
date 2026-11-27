"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { showLoadFailureOnce } from "@/common/helpers/showLoadFailureOnce";
import type {
  OrderListPage,
  OrderListStatus,
} from "@/common/types/order.types";
import {
  type OrdersEmptyState,
  ordersEmptyState,
} from "@/features/pages/Orders/lib/emptyState";
import { countForStatus } from "@/features/pages/Orders/lib/tabs";
import { useGetOrders } from "@/hooks/order/useGetOrders";
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

export const useOrdersScreen = (): UseOrdersScreenReturn => {
  const t = useTranslations("orders");
  const [status, setStatus] = useState<OrderListStatus>("ALL");
  const { inputValue, debouncedQuery, setInputValue } = useOrderSearch();
  const { page, isLoading, isValidating, error, mutate } = useGetOrders({
    status,
    q: debouncedQuery,
  });

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

    empty: failed ? "none" : decided,
    retry: () => {
      void mutate();
    },
  };
};
