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

const ORDER_LIST_CONFIG = {
  keepPreviousData: true,
  revalidateOnFocus: false,
  shouldRetryOnError: false,
} as const;

type UseGetOrdersOptions = { enabled?: boolean };

export const useGetOrders = (
  filters: OrderListFilters = {},
  { enabled = true }: UseGetOrdersOptions = {},
): UseGetOrdersReturn => {
  const { getData } = useFetcher();

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    OrderListPage,
    GetOrdersError
  >(enabled ? orderListKey(filters) : null, getData, ORDER_LIST_CONFIG);

  return {
    page: data,
    isLoading,
    isValidating,
    error: error ?? null,
    mutate,
  };
};
