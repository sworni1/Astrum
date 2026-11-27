"use client";

import useSWRMutation from "swr/mutation";
import { useFetcher } from "@/hooks/useFetcher";
import type { StaffAnswer } from "./staff.types";

export interface UseGrantCourierReturn {
  run: () => Promise<StaffAnswer>;
  isSubmitting: boolean;
  error: unknown;
}

export const useGrantCourier = (): UseGrantCourierReturn => {
  const { postItem } = useFetcher();

  const { trigger, isMutating, error } = useSWRMutation<
    StaffAnswer,
    unknown,
    string,
    Record<string, never> | undefined
  >("/staff/courier", postItem);

  return {
    run: () => trigger(undefined),
    isSubmitting: isMutating,
    error,
  };
};
