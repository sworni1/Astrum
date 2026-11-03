"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type {
  OrderItem,
  UpdateOrderItemStatusDto,
} from "../../common/types/order.types";
import { useFetcher } from "../useFetcher";

export type UpdateOrderItemStatusError = {
  message: string;
  status?: number;
};

export type UpdateOrderItemStatusTrigger = (
  data: UpdateOrderItemStatusDto,
) => Promise<OrderItem>;

export interface UseUpdateOrderItemStatusReturn {
  updateOrderItemStatusTrigger: UpdateOrderItemStatusTrigger;
  updateOrderItemStatusIsMutating: boolean;
  updateOrderItemStatusError: UpdateOrderItemStatusError | null;
}

export const useUpdateOrderItemStatus = (
  orderItemId: string,
): UseUpdateOrderItemStatusReturn => {
  const { patchItem } = useFetcher();
  const { mutate } = useSWRConfig();

  const {
    trigger: updateOrderItemStatusTrigger,
    isMutating: updateOrderItemStatusIsMutating,
    error: rawError,
  } = useSWRMutation<
    OrderItem,
    UpdateOrderItemStatusError,
    string,
    UpdateOrderItemStatusDto
  >(`/order-items/${orderItemId}/status`, patchItem, {
    onSuccess: async (updatedItem) => {
      await mutate(`/orders/${updatedItem.orderId}`);
      await mutate(`/orders`);
    },
  });

  return {
    updateOrderItemStatusTrigger,
    updateOrderItemStatusIsMutating,
    updateOrderItemStatusError: rawError ?? null,
  };
};
