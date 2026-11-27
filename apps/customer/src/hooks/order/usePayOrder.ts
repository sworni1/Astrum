"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { PayOrderResponse } from "@/common/types/order.types";
import { useFetcher } from "@/hooks/useFetcher";
import { isOrderListKey } from "./orderListKey";

export interface UsePayOrderReturn {
  startPayment: () => Promise<PayOrderResponse>;
  isStarting: boolean;

  revalidateOrder: () => Promise<void>;
}

export const usePayOrder = (orderId: string): UsePayOrderReturn => {
  const { postItem } = useFetcher();
  const { mutate } = useSWRConfig();

  const orderKey = `/orders/${orderId}`;

  const revalidateOrder = useCallback(async (): Promise<void> => {
    await Promise.allSettled([mutate(orderKey), mutate(isOrderListKey)]);
  }, [mutate, orderKey]);

  const { trigger, isMutating } = useSWRMutation<
    PayOrderResponse,
    unknown,
    string,
    void
  >(`${orderKey}/payment`, (url: string) => postItem(url, { arg: {} }));

  return {
    startPayment: trigger,
    isStarting: isMutating,
    revalidateOrder,
  };
};
