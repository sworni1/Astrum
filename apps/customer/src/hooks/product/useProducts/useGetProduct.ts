"use client";

import useSWR from "swr";
import type { ProductOverview } from "../../../common/types/product.types";
import { useFetcher } from "../../useFetcher";

export const useGetProduct = (productId: string) => {
  const { getData } = useFetcher();

  const {
    data: product,
    isLoading: productIsLoading,
    error: productError,
  } = useSWR<ProductOverview>(`/products/${productId}`, getData, {
    compare: (a, b) => a === b,
    keepPreviousData: true,
  });

  return {
    product,
    productIsLoading,
    productError,
  };
};
