"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { showLoadFailureOnce } from "@/common/helpers/showLoadFailureOnce";
import type {
  SellerLineCounts,
  SellerListStatus,
  SellerSalesPage,
  SellerSalesStats,
} from "@/common/types/order.types";
import {
  type SalesEmptyState,
  salesEmptyState,
} from "@/features/pages/SellerOrders/lib/emptyState";
import { countForStatus } from "@/features/pages/SellerOrders/lib/status";
import {
  type SellerErrorKind,
  sellerErrorKind,
} from "@/hooks/seller/sellerError";
import { useSellerOrders } from "@/hooks/seller/useSellerOrders";

export const SELLER_SEARCH_DEBOUNCE_MS = 300;

export interface UseSalesFiltersReturn {
  status: SellerListStatus;
  selectStatus: (status: SellerListStatus) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  debouncedQuery: string;
  setPageNumber: (page: number) => void;
  page: SellerSalesPage | undefined;
  counts: SellerLineCounts | undefined;
  stats: SellerSalesStats | undefined;
  kind: SellerErrorKind;
  isLoading: boolean;
  isValidating: boolean;
  firstLoad: boolean;
  failed: boolean;
  empty: SalesEmptyState;
  retry: () => void;
}

export const useSalesFilters = (): UseSalesFiltersReturn => {
  const t = useTranslations("seller");
  const [status, setStatus] = useState<SellerListStatus>("ALL");
  const [pageNumber, setPageNumber] = useState(1);
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const trimmed = inputValue.trim();

    const timer = setTimeout(
      () => {
        setDebouncedQuery(trimmed);
        setPageNumber(1);
      },
      trimmed === "" ? 0 : SELLER_SEARCH_DEBOUNCE_MS,
    );

    return () => {
      clearTimeout(timer);
    };
  }, [inputValue]);

  const { page, error, isLoading, isValidating, mutate } = useSellerOrders({
    status,
    q: debouncedQuery,
    page: pageNumber,
  });

  const kind = sellerErrorKind(error);

  useEffect(() => {
    if (kind === "failure") {
      showLoadFailureOnce(error, t("states.failureTitle"));
    }
  }, [error, kind, t]);

  useEffect(() => {
    if (!page || page.total === 0 || page.items.length > 0) {
      return;
    }

    if (page.totalPages > 0 && page.totalPages !== pageNumber) {
      setPageNumber(page.totalPages);
    }
  }, [page, pageNumber]);

  const failed = error !== null;
  const decided = salesEmptyState({
    itemCount: page?.items.length ?? 0,
    allCount: page?.counts.all ?? 0,
    tabCount: page === undefined ? 0 : countForStatus(page.counts, status),
    query: debouncedQuery,
    isValidating,
  });

  return {
    status,
    selectStatus: (next) => {
      setStatus(next);
      setPageNumber(1);
    },
    inputValue,
    setInputValue,
    debouncedQuery,
    setPageNumber,
    page,
    counts: page?.counts,
    stats: page?.stats,
    kind,
    isLoading,
    isValidating,
    firstLoad: isLoading && page === undefined,
    failed,

    empty: failed ? "none" : decided,
    retry: () => {
      void mutate();
    },
  };
};
