"use client";

import useSWR, { type KeyedMutator } from "swr";
import type { PickupPoint } from "@/common/types/order.types";
import { useFetcher } from "@/hooks/useFetcher";

export type PickupPointsResponse = { points: PickupPoint[] };

export type GetPickupPointsError = {
  message: string;
  status?: number;
};

export interface UsePickupPointsReturn {
  points: PickupPoint[];
  isLoading: boolean;
  error: GetPickupPointsError | null;
  mutate: KeyedMutator<PickupPointsResponse>;
}

/** The collection points the shop runs, read from the gateway. */
export const usePickupPoints = (): UsePickupPointsReturn => {
  const { getData } = useFetcher();
  const { data, error, isLoading, mutate } = useSWR<
    PickupPointsResponse,
    GetPickupPointsError
  >("/pickup-points", getData);

  return {
    points: data?.points ?? [],
    isLoading,
    error: error ?? null,
    mutate,
  };
};
