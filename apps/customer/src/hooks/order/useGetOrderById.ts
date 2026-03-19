"use client";

import useSWR from "swr";
import { useFetcher } from "../useFetcher";
import { Order } from "../../common/types/order.types";

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
