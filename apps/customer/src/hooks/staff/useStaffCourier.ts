"use client";

import useSWR, { type KeyedMutator } from "swr";
import type { StaffRole } from "@/common/types/user.types";
import { useFetcher } from "@/hooks/useFetcher";
import type { StaffAnswer } from "./staff.types";

export interface UseStaffCourierReturn {
  answer: StaffAnswer | undefined;
  staffRoles: StaffRole[];
  isLoading: boolean;
  error: unknown;
  mutate: KeyedMutator<StaffAnswer>;
}

export const useStaffCourier = (): UseStaffCourierReturn => {
  const { getData } = useFetcher();
  const { data, error, isLoading, mutate } = useSWR<StaffAnswer>(
    "/staff/courier",
    getData,
  );

  return {
    answer: data,
    staffRoles: data?.staffRoles ?? [],
    isLoading,
    error: error ?? null,
    mutate,
  };
};
