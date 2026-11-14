"use client";

import { useCallback, useRef, useState } from "react";
import { useFetcher } from "@/hooks/useFetcher";
import type { PointOrder } from "./pointOrder.types";

export type PointOrderActionName = "handover" | "cancel";

export type PendingPointOrderAction = {
  orderId: string;
  action: PointOrderActionName;
};

export interface UsePointOrderActionReturn {
  /** Null when a request is already in flight, so a second press sends nothing. */
  run: (
    orderId: string,
    action: PointOrderActionName,
  ) => Promise<PointOrder | null>;
  pending: PendingPointOrderAction | null;
}

const NO_BODY = {} as Record<string, never>;

/**
 * One action on one order, with the busy state the screen paints. The ref is
 * the second press guard, because a state update lands one render late
 * (spec 0018, AC-11).
 */
export const usePointOrderAction = (): UsePointOrderActionReturn => {
  const { patchItem } = useFetcher();
  const [pending, setPending] = useState<PendingPointOrderAction | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(
    async (
      orderId: string,
      action: PointOrderActionName,
    ): Promise<PointOrder | null> => {
      if (inFlight.current) {
        return null;
      }

      inFlight.current = true;
      setPending({ orderId, action });

      try {
        const answer = await patchItem<Record<string, never>>(
          `/staff/point/orders/${orderId}/${action}`,
          { arg: NO_BODY },
        );

        return (answer as { order: PointOrder }).order;
      } finally {
        inFlight.current = false;
        setPending(null);
      }
    },
    [patchItem],
  );

  return { run, pending };
};
