"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { useFetcher } from "../../useFetcher";

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
