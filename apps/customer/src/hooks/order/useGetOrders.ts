"use client";

import useSWR from "swr";
import { useFetcher } from "../useFetcher";
import { Order } from "../../common/types/order.types";

export type GetOrdersError = {
  message: string;
  status?: number;
};

export interface UseGetOrdersReturn {
  orders: Order[] | undefined;
  isLoading: boolean;
  error: GetOrdersError | null;
  mutate: (
    data?: Order[] | Promise<Order[]>,
    shouldRevalidate?: boolean,
  ) => Promise<Order[] | undefined>;
}

export const useGetOrders = (): UseGetOrdersReturn => {
  const { getData } = useFetcher();

  const { data, error, isLoading, mutate } = useSWR<Order[], GetOrdersError>(
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
