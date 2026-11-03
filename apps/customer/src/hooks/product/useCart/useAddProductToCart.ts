"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { useFetcher } from "../../useFetcher";

export const useAddProductToCart = () => {
  const { postItem } = useFetcher();
  const { mutate } = useSWRConfig();

  const {
    trigger: addProductToCartTrigger,
    isMutating: addProductToCartLoading,
    error: addProductToCartError,
  } = useSWRMutation("/cart", postItem, {
    onSuccess: async () => await mutate("/cart"),
  });

  return {
    addProductToCartTrigger,
    addProductToCartLoading,
    addProductToCartError,
  };
};
