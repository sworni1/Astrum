"use client";

import useSWRMutation from "swr/mutation";
import type {
  OrderItemStatus,
  SellerOrderLine,
} from "../../common/types/order.types";
import { useFetcher } from "../useFetcher";

export type SellerStatusChange = { status: OrderItemStatus };

export interface UseSellerOrderItemStatusReturn {
  changeStatus: (change: SellerStatusChange) => Promise<SellerOrderLine>;
  isChanging: boolean;
  error: unknown;
}

/**
 * One status change for one line. `onUpdated` receives the line from the
 * response body, so the caller writes the answer the server sent into the page
 * before it revalidates.
 */
export const useSellerOrderItemStatus = (
  orderItemId: string,
  onUpdated: (line: SellerOrderLine) => Promise<void> | void,
): UseSellerOrderItemStatusReturn => {
  const { patchItem } = useFetcher();

  const { trigger, isMutating, error } = useSWRMutation<
    SellerOrderLine,
    unknown,
    string,
    SellerStatusChange
  >(`/order-items/${orderItemId}/status`, patchItem, {
    onSuccess: async (line) => {
      await onUpdated(line);
    },
  });

  return { changeStatus: trigger, isChanging: isMutating, error };
};
