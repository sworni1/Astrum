"use client";

import useSWRMutation from "swr/mutation";
import { useFetcher } from "../../useFetcher";
import { useSWRConfig } from "swr";

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
