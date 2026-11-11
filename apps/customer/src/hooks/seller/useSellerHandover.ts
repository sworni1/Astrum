"use client";

import useSWRMutation from "swr/mutation";
import type { SellerOrderGroup } from "@/common/types/order.types";
import { useFetcher } from "@/hooks/useFetcher";

type HandoverResponse = { order: SellerOrderGroup };

export interface UseSellerHandoverReturn {
  handOver: () => Promise<SellerOrderGroup>;
  isHandingOver: boolean;
  error: unknown;
}

/**
 * One handover for one pickup group: the answered order carries the delivered
 * lines, so the caller writes the answer into the page before it revalidates
 * (spec 0013, AC-13).
 */
export const useSellerHandover = (
  orderId: string,
  onHandedOver: (group: SellerOrderGroup) => Promise<void> | void,
): UseSellerHandoverReturn => {
  const { patchItem } = useFetcher();

  const { trigger, isMutating, error } = useSWRMutation<
    HandoverResponse,
    unknown,
    string,
    Record<string, never>
  >(`/seller/orders/${orderId}/handover`, patchItem, {
    onSuccess: async ({ order }) => {
      await onHandedOver(order);
    },
  });

  return {
    handOver: async () => (await trigger({})).order,
    isHandingOver: isMutating,
    error,
  };
};
