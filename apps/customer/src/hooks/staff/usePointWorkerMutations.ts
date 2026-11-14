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

/** One deliberate action attaches the account to one active point (AC-4). */
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

/** The same route with a different point writes the move of AC-8. */
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
