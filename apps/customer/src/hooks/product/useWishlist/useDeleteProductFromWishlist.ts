"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { useFetcher } from "@/hooks/useFetcher";

export const useDeleteProductFromWishlist = (productId: string) => {
  const { deleteItem } = useFetcher();
  const { mutate } = useSWRConfig();

  const {
    trigger: deleteProductToWishlistTrigger,
    isMutating: deleteProductToWishlistLoading,
    error: deleteProductFromWishlistError,
  } = useSWRMutation(`/wishlist/${productId}`, deleteItem, {
    onSuccess: async () =>
      await Promise.all([
        mutate("/wishlist"),
        mutate(`/products/${productId}`),
      ]),
  });

  return {
    deleteProductToWishlistTrigger,
    deleteProductToWishlistLoading,
    deleteProductFromWishlistError,
  };
};
