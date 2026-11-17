"use client";

import useSWR, { type KeyedMutator } from "swr";
import type {
  SellerListStatus,
  SellerSalesPage,
} from "@/common/types/order.types";
import { useFetcher } from "@/hooks/useFetcher";
import { type SellerErrorKind, sellerErrorKind } from "./sellerError";

/** The table slices 20 lines per page (spec 0026, AC-10). */
export const SELLER_ORDERS_PAGE_SIZE = 20;

const SELLER_ORDERS_KEY = "/seller/orders";

/** What the screen sends: the chosen tab, the settled query and the page. */
export type SellerOrdersFilters = {
  status?: SellerListStatus;
  q?: string;
  page?: number;
};

/**
 * The request key of the seller read. The `ALL` tab sends no status and an empty
 * query sends no `q`, so the unfiltered first page is one stable key the whole
 * screen shares (spec 0026, AC-7, AC-8).
 */
export const sellerOrdersKey = ({
  status,
  q,
  page = 1,
}: SellerOrdersFilters = {}): string => {
  const params = new URLSearchParams();

  if (status !== undefined && status !== "ALL") {
    params.set("status", status);
  }

  const query = q?.trim() ?? "";

  if (query !== "") {
    params.set("q", query);
  }

  params.set("page", String(page));
  params.set("limit", String(SELLER_ORDERS_PAGE_SIZE));

  return `${SELLER_ORDERS_KEY}?${params.toString()}`;
};

/**
 * The previous answer stays on screen while a new key loads, so a tab switch or
 * a settled query never blanks the table (spec 0026, AC-7, AC-8).
 */
const SELLER_ORDERS_CONFIG = {
  keepPreviousData: true,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  shouldRetryOnError: false,
} as const;

export interface UseSellerOrdersReturn {
  page: SellerSalesPage | undefined;
  error: unknown;
  kind: SellerErrorKind;
  isLoading: boolean;
  isValidating: boolean;
  mutate: KeyedMutator<SellerSalesPage>;
}

export const useSellerOrders = (
  filters: SellerOrdersFilters = {},
): UseSellerOrdersReturn => {
  const { getData } = useFetcher();

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    SellerSalesPage,
    unknown
  >(sellerOrdersKey(filters), getData, SELLER_ORDERS_CONFIG);

  return {
    page: data,
    error: error ?? null,
    kind: sellerErrorKind(error),
    isLoading,
    isValidating,
    mutate,
  };
};
