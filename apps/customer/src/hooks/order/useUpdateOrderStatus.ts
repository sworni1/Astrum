"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { Order, UpdateOrderStatusDto } from "@/common/types/order.types";
import { useFetcher } from "@/hooks/useFetcher";
import { isOrderListKey } from "./orderListKey";

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

  revalidateOrder: () => Promise<void>;
}

export const useUpdateOrderStatus = (
  orderId: string,
): UseUpdateOrderStatusReturn => {
  const { patchItem } = useFetcher();
  const { mutate } = useSWRConfig();

  const orderKey = `/orders/${orderId}`;

  const revalidateOrder = useCallback(async (): Promise<void> => {
    await Promise.allSettled([mutate(orderKey), mutate(isOrderListKey)]);
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
