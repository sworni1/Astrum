"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { PayOrderResponse } from "@/common/types/order.types";
import { useFetcher } from "@/hooks/useFetcher";

const ORDER_LIST_KEY = "/orders";

export interface UsePayOrderReturn {
  /** Opens a provider session and answers where the browser goes (AC-13). */
  startPayment: () => Promise<PayOrderResponse>;
  isStarting: boolean;
  /** Re reads the order and the list, and never rejects on a failed read. */
  revalidateOrder: () => Promise<void>;
}

export const usePayOrder = (orderId: string): UsePayOrderReturn => {
  const { postItem } = useFetcher();
  const { mutate } = useSWRConfig();

  const orderKey = `/orders/${orderId}`;

  const revalidateOrder = useCallback(async (): Promise<void> => {
    // allSettled, not all: the toast is the answer the customer needs, and a
    // failed re read must not replace it (AC-13).
    await Promise.allSettled([mutate(orderKey), mutate(ORDER_LIST_KEY)]);
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
