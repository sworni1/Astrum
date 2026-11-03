"use client";

import useSWR from "swr";
import type { ProductCartProps } from "../../../common/types/product.types";
import { useFetcher } from "../../useFetcher";

export const useGetCart = () => {
  const { getData } = useFetcher();

  const {
    data: cart,
    isLoading: cartIsLoading,
    error: cartError,
  } = useSWR<ProductCartProps[]>(`/cart`, getData);

  return {
    cart,
    cartIsLoading,
    cartError,
  };
};
