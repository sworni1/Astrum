"use client";

import useSWR from "swr";
import { useFetcher } from "../../useFetcher";
import { ProductCartProps } from "../../../common/types/product.types";

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
