"use client";

import useSWR from "swr";
import { useFetcher } from "../../useFetcher";
import { ProductCardProps } from "../../../common/types/product.types";

export const useGetWishlist = () => {
  const { getData } = useFetcher();

  const {
    data: wishlist,
    isLoading: wishlistIsLoading,
    error: wishlistError,
  } = useSWR<ProductCardProps[]>(`/wishlist`, getData);

  return {
    wishlist,
    wishlistIsLoading,
    wishlistError,
  };
};
