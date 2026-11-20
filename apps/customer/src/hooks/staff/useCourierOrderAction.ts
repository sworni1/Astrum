"use client";

import { useCallback, useRef, useState } from "react";
import { useFetcher } from "@/hooks/useFetcher";
import { NO_BODY } from "./staffPage";
import type { CourierOrder } from "./courierOrder.types";

export type CourierOrderActionName = "claim" | "release" | "handover" | "cancel";

export type PendingCourierOrderAction = {
  orderId: string;
  action: CourierOrderActionName;
};

export interface UseCourierOrderActionReturn {
  run: (
    orderId: string,
    action: CourierOrderActionName,
  ) => Promise<CourierOrder | null>;
  pending: PendingCourierOrderAction | null;
}

export const useCourierOrderAction = (): UseCourierOrderActionReturn => {
  const { postItem, deleteItem, patchItem } = useFetcher();
  const [pending, setPending] = useState<PendingCourierOrderAction | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(
    async (
      orderId: string,
      action: CourierOrderActionName,
    ): Promise<CourierOrder | null> => {
      if (inFlight.current) {
        return null;
      }

      inFlight.current = true;
      setPending({ orderId, action });

      const claimPath = `/staff/courier/orders/${orderId}/claim`;

      try {
        const answer = await (() => {
          if (action === "claim") {
            return postItem<Record<string, never>>(claimPath, { arg: NO_BODY });
          }

          if (action === "release") {
            return deleteItem(claimPath);
          }

          return patchItem<Record<string, never>>(
            `/staff/courier/orders/${orderId}/${action}`,
            { arg: NO_BODY },
          );
        })();

        return (answer as { order: CourierOrder }).order;
      } finally {
        inFlight.current = false;
        setPending(null);
      }
    },
    [postItem, deleteItem, patchItem],
  );

  return { run, pending };
};
