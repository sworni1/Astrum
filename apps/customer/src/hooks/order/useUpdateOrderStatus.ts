"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { Order, UpdateOrderStatusDto } from "@/common/types/order.types";
import { useFetcher } from "@/hooks/useFetcher";

const ORDER_LIST_KEY = "/orders";

export type UpdateOrderStatusError = {
  message: string;
  status?: number;
};

export type UpdateOrderStatusTrigger = (
  data: UpdateOrderStatusDto,
) => Promise<Order>;

export interface UseUpdateOrderStatusReturn {
  updateOrderStatusTrigger: UpdateOrderStatusTrigger;
  updateOrderStatusIsMutating: boolean;
  updateOrderStatusError: UpdateOrderStatusError | null;
  /** Re reads the order and the list, and never rejects on a failed read. */
  revalidateOrder: () => Promise<void>;
}

export const useUpdateOrderStatus = (
  orderId: string,
): UseUpdateOrderStatusReturn => {
  const { patchItem } = useFetcher();
  const { mutate } = useSWRConfig();

  const orderKey = `/orders/${orderId}`;

  const revalidateOrder = useCallback(async (): Promise<void> => {
    // allSettled, not all: a failed re read must not reject out of the caller's
    // handler, because the toast is the answer the customer needs (AC-6).
    await Promise.allSettled([mutate(orderKey), mutate(ORDER_LIST_KEY)]);
  }, [mutate, orderKey]);

  const {
    trigger: updateOrderStatusTrigger,
    isMutating: updateOrderStatusIsMutating,
    error: rawError,
  } = useSWRMutation<
    Order,
    UpdateOrderStatusError,
    string,
    UpdateOrderStatusDto
  >(`${orderKey}/status`, patchItem, {
    onSuccess: async (order) => {
      // The answer is the new truth: it lands in the cache before the background
      // read, and the list follows because it shows the same status (AC-5).
      await mutate(orderKey, order, false);
      await revalidateOrder();
    },
  });

  return {
    updateOrderStatusTrigger,
    updateOrderStatusIsMutating,
    updateOrderStatusError: rawError ?? null,
    revalidateOrder,
  };
};
