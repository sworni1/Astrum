"use client";

import useSWR from "swr";
import { useFetcher } from "../../useFetcher";
import { ProductOverview } from "../../../common/types/product.types";

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
