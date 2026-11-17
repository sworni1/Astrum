"use client";

import useSWR, { type KeyedMutator } from "swr";
import type { OrderListPage } from "@/common/types/order.types";
import { useFetcher } from "@/hooks/useFetcher";
import { type OrderListFilters, orderListKey } from "./orderListKey";

export type GetOrdersError = {
  message: string;
  status?: number;
};

export interface UseGetOrdersReturn {
  page: OrderListPage | undefined;
  isLoading: boolean;
  isValidating: boolean;
  error: GetOrdersError | null;
  mutate: KeyedMutator<OrderListPage>;
}

/**
 * The previous answer stays on screen while a new key loads, so a tab switch or
 * a settled query never blanks the list (spec 0025, AC-8, AC-9).
 */
const ORDER_LIST_CONFIG = {
  keepPreviousData: true,
  revalidateOnFocus: false,
  shouldRetryOnError: false,
} as const;

export const useGetOrders = (
  filters: OrderListFilters = {},
): UseGetOrdersReturn => {
  const { getData } = useFetcher();

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    OrderListPage,
    GetOrdersError
  >(orderListKey(filters), getData, ORDER_LIST_CONFIG);

  return {
    page: data,
    isLoading,
    isValidating,
    error: error ?? null,
    mutate,
  };
};
