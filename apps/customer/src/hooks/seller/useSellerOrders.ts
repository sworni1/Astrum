"use client";

import useSWR, { type KeyedMutator } from "swr";
import type {
  SellerListStatus,
  SellerSalesPage,
} from "@/common/types/order.types";
import { useFetcher } from "@/hooks/useFetcher";
import { type SellerErrorKind, sellerErrorKind } from "./sellerError";

export const SELLER_ORDERS_PAGE_SIZE = 20;

const SELLER_ORDERS_KEY = "/seller/orders";

export type SellerOrdersFilters = {
  status?: SellerListStatus;
  q?: string;
  page?: number;
};

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
