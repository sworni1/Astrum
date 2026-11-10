"use client";

import useSWR, { type KeyedMutator } from "swr";
import type { ShippingMethod } from "../../common/types/order.types";
import { useFetcher } from "../useFetcher";

export type ShippingMethodsResponse = { methods: ShippingMethod[] };

export type GetShippingMethodsError = {
  message: string;
  status?: number;
};

export interface UseShippingMethodsReturn {
  methods: ShippingMethod[];
  isLoading: boolean;
  error: GetShippingMethodsError | null;
  mutate: KeyedMutator<ShippingMethodsResponse>;
}

/** The delivery methods the shop offers, read from the gateway (AC-8). */
export const useShippingMethods = (): UseShippingMethodsReturn => {
  const { getData } = useFetcher();
  const { data, error, isLoading, mutate } = useSWR<
    ShippingMethodsResponse,
    GetShippingMethodsError
  >("/shipping-methods", getData);

  return {
    methods: data?.methods ?? [],
    isLoading,
    error: error ?? null,
    mutate,
  };
};
