"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { useFetcher } from "@/hooks/useFetcher";

export const useDeleteProductFromCart = (productId: string) => {
  const { deleteItem } = useFetcher();
  const { mutate } = useSWRConfig();

  const {
    trigger: deleteProductFromCartTrigger,
    isMutating: deleteProductFromCartLoading,
    error: deleteProductFromCartError,
  } = useSWRMutation(`/cart/${productId}`, deleteItem, {
    onSuccess: async () => await mutate("/cart"),
  });

  return {
    deleteProductFromCartTrigger,
    deleteProductFromCartLoading,
    deleteProductFromCartError,
  };
};
