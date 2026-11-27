"use client";

import useSWRMutation from "swr/mutation";
import { useFetcher } from "@/hooks/useFetcher";
import type { StaffAnswer } from "./staff.types";

export type PointWorkerInput = { pickupPointId: string };

export interface UsePointWorkerMutationReturn {
  run: (input: PointWorkerInput) => Promise<StaffAnswer>;
  isSubmitting: boolean;
  error: unknown;
}

export const useGrantPointWorker = (): UsePointWorkerMutationReturn => {
  const { postItem } = useFetcher();

  const { trigger, isMutating, error } = useSWRMutation<
    StaffAnswer,
    unknown,
    string,
    PointWorkerInput
  >("/staff/point-worker", postItem);

  return { run: trigger, isSubmitting: isMutating, error };
};

export const useMovePointWorker = (): UsePointWorkerMutationReturn => {
  const { patchItem } = useFetcher();

  const { trigger, isMutating, error } = useSWRMutation<
    StaffAnswer,
    unknown,
    string,
    PointWorkerInput
  >("/staff/point-worker", patchItem);

  return { run: trigger, isSubmitting: isMutating, error };
};
