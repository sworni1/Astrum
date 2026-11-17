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
import { type SellerErrorKind, sellerErrorKind } from "@/hooks/seller/sellerError";
import { useSellerOrders } from "@/hooks/seller/useSellerOrders";
import { type SalesEmptyState, salesEmptyState } from "@/features/pages/SellerOrders/lib/emptyState";
import { countForStatus } from "@/features/pages/SellerOrders/lib/status";

/** The field settles 300 ms after the last keystroke (spec 0026, AC-8). */
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

/**
 * The screen's own state as one hook: the chosen tab, the debounced query and the
 * page, plus the read they feed and the one verdict about which empty state
 * applies. The tab, the query and the page are request parameters, never client
 * predicates (spec 0026, AC-7, AC-8, AC-11).
 */
export const useSalesFilters = (): UseSalesFiltersReturn => {
  const t = useTranslations("seller");
  const [status, setStatus] = useState<SellerListStatus>("ALL");
  const [pageNumber, setPageNumber] = useState(1);
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const trimmed = inputValue.trim();

    // Clearing settles on the next tick, so returning to the unfiltered list
    // never waits for the typing debounce (spec 0026, AC-8).
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

  // One toast per failed read, raised from an effect and never from the render
  // body (storefront rule S4). The helper holds the identity of the error, so a
  // re-render or a second consumer raises nothing new. A typed refusal is not a
  // failure: the not a seller screen owns that answer (spec 0026, AC-11).
  const kind = sellerErrorKind(error);

  useEffect(() => {
    if (kind === "failure") {
      showLoadFailureOnce(error, t("states.failureTitle"));
    }
  }, [error, kind, t]);

  // A page above the last one asks for the last page, so the screen never prints
  // «Страница 3 из 2» (spec 0026, AC-10).
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
    // A failed read renders no empty state at all; its own block owns the block.
    empty: failed ? "none" : decided,
    retry: () => {
      void mutate();
    },
  };
};
