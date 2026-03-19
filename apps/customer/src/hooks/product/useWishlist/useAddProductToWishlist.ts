"use client";

import useSWRMutation from "swr/mutation";
import { useFetcher } from "../../useFetcher";
import { useSWRConfig } from "swr";

export const useAddProductToWishlist = (productId: string) => {
  const { postItem } = useFetcher();
  const { mutate } = useSWRConfig();

  const {
    trigger: addProductToWishlistTrigger,
    isMutating: addProductToWishlistLoading,
    error: addProductToWishlistError,
  } = useSWRMutation("/wishlist", postItem, {
    onSuccess: async () =>
      await Promise.all([
        mutate("/wishlist"),
        mutate(`/products/${productId}`),
      ]),
  });

  return {
    addProductToWishlistTrigger,
    addProductToWishlistLoading,
    addProductToWishlistError,
  };
};
