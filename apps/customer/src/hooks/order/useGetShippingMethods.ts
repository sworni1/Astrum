"use client";

import useSWR from "swr";
import { useFetcher } from "../useFetcher";
import { ShippingMethod } from "../../common/types/order.types";

export type GetShippingMethodsError = {
  message: string;
  status?: number;
};

export interface UseGetShippingMethodsReturn {
  shippingMethods: ShippingMethod[] | undefined;
  isLoading: boolean;
  error: GetShippingMethodsError | null;
  mutate: (
    data?: ShippingMethod[] | Promise<ShippingMethod[]>,
    shouldRevalidate?: boolean,
  ) => Promise<ShippingMethod[] | undefined>;
}

export const useGetShippingMethods = (): UseGetShippingMethodsReturn => {
  const { getData } = useFetcher();

  const { data, error, isLoading, mutate } = useSWR<
    ShippingMethod[],
    GetShippingMethodsError
  >(`/shipping-methods`, getData);

  return {
    shippingMethods: data,
    isLoading,
    error: error ?? null,
    mutate,
  };
};
