"use client";

import useSWR, { type KeyedMutator } from "swr";
import type { SellerOrdersPage } from "../../common/types/order.types";
import { useFetcher } from "../useFetcher";
import { sellerErrorKind, type SellerErrorKind } from "./sellerError";

export const SELLER_ORDERS_PAGE_SIZE = 20;

export const sellerOrdersKey = (page: number): string =>
  `/seller/orders?page=${page}&limit=${SELLER_ORDERS_PAGE_SIZE}`;

const SELLER_ORDERS_CONFIG = {
  keepPreviousData: true,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  shouldRetryOnError: false,
} as const;

export interface UseSellerOrdersReturn {
  data: SellerOrdersPage | undefined;
  error: unknown;
  kind: SellerErrorKind;
  isLoading: boolean;
  isValidating: boolean;
  mutate: KeyedMutator<SellerOrdersPage>;
}

export const useSellerOrders = (page: number): UseSellerOrdersReturn => {
  const { getData } = useFetcher();

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    SellerOrdersPage,
    unknown
  >(sellerOrdersKey(page), getData, SELLER_ORDERS_CONFIG);

  return {
    data,
    error,
    kind: sellerErrorKind(error),
    isLoading,
    isValidating,
    mutate,
  };
};
