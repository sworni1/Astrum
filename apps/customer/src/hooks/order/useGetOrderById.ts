"use client";

import useSWR from "swr";
import type { Order } from "@/common/types/order.types";
import { useFetcher } from "@/hooks/useFetcher";

export type GetOrderByIdError = {
  message: string;
  status?: number;
};

export interface UseGetOrderByIdReturn {
  order: Order | undefined;
  isLoading: boolean;
  error: GetOrderByIdError | null;
  mutate: (
    data?: Order | Promise<Order>,
    shouldRevalidate?: boolean,
  ) => Promise<Order | undefined>;
}

export const useGetOrderById = (orderId: string): UseGetOrderByIdReturn => {
  const { getData } = useFetcher();

  // Ensure orderId is valid before making the request
  const shouldFetch = orderId && orderId.trim() !== "";
  const key = shouldFetch ? `/orders/${orderId}` : null;

  const { data, error, isLoading, mutate } = useSWR<Order, GetOrderByIdError>(
    key,
    getData,
  );

  return {
    order: data,
    isLoading,
    error: error ?? null,
    mutate,
  };
};
