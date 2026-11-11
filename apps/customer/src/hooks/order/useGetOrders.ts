"use client";

import useSWR from "swr";
import type { OrderListItem } from "@/common/types/order.types";
import { useFetcher } from "@/hooks/useFetcher";

export type GetOrdersError = {
  message: string;
  status?: number;
};

export interface UseGetOrdersReturn {
  orders: OrderListItem[] | undefined;
  isLoading: boolean;
  error: GetOrdersError | null;
  mutate: (
    data?: OrderListItem[] | Promise<OrderListItem[]>,
    shouldRevalidate?: boolean,
  ) => Promise<OrderListItem[] | undefined>;
}

export const useGetOrders = (): UseGetOrdersReturn => {
  const { getData } = useFetcher();

  const { data, error, isLoading, mutate } = useSWR<
    OrderListItem[],
    GetOrdersError
  >(
    `/orders`,
    getData,
  );

  return {
    orders: data,
    isLoading,
    error: error ?? null,
    mutate,
  };
};
