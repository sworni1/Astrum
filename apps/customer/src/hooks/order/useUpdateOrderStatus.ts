"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { Order, UpdateOrderStatusDto } from "@/common/types/order.types";
import { useFetcher } from "@/hooks/useFetcher";

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
}

export const useUpdateOrderStatus = (
  orderId: string,
): UseUpdateOrderStatusReturn => {
  const { patchItem } = useFetcher();
  const { mutate } = useSWRConfig();

  const {
    trigger: updateOrderStatusTrigger,
    isMutating: updateOrderStatusIsMutating,
    error: rawError,
  } = useSWRMutation<
    Order,
    UpdateOrderStatusError,
    string,
    UpdateOrderStatusDto
  >(`/orders/${orderId}/status`, patchItem, {
    onSuccess: async () => {
      await mutate(`/orders/${orderId}`);
      await mutate(`/orders`);
    },
  });

  return {
    updateOrderStatusTrigger,
    updateOrderStatusIsMutating,
    updateOrderStatusError: rawError ?? null,
  };
};
