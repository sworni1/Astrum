"use client";

import useSWRMutation from "swr/mutation";
import { useFetcher } from "@/hooks/useFetcher";

export const useChangeProductCartQuantity = (productId: string) => {
  const { patchItem } = useFetcher();

  const {
    trigger: changeProductCartQuantityTrigger,
    isMutating: changeProductCartQuantityLoading,
    error: changeProductCartQuantityError,
  } = useSWRMutation(`/cart/${productId}`, patchItem);

  return {
    changeProductCartQuantityTrigger,
    changeProductCartQuantityLoading,
    changeProductCartQuantityError,
  };
};
