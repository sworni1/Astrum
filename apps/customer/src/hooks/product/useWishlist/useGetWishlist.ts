"use client";

import useSWR from "swr";
import type { ProductCardProps } from "@/common/types/product.types";
import { useFetcher } from "@/hooks/useFetcher";

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
