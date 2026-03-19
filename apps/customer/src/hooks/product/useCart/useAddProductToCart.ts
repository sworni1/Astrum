"use client";

import useSWRMutation from "swr/mutation";
import { useFetcher } from "../../useFetcher";
import { useSWRConfig } from "swr";

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
