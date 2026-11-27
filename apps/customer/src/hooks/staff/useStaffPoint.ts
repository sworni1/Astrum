"use client";

import useSWR, { type KeyedMutator } from "swr";
import type { StaffRole } from "@/common/types/user.types";
import { useFetcher } from "@/hooks/useFetcher";
import type { StaffAnswer, StaffPoint } from "./staff.types";

export interface UseStaffPointReturn {
  answer: StaffAnswer | undefined;
  point: StaffPoint | null;
  staffRoles: StaffRole[];
  isLoading: boolean;
  error: unknown;
  mutate: KeyedMutator<StaffAnswer>;
}

export const useStaffPoint = (): UseStaffPointReturn => {
  const { getData } = useFetcher();
  const { data, error, isLoading, mutate } = useSWR<StaffAnswer>(
    "/staff/point",
    getData,
  );

  return {
    answer: data,
    point: data?.point ?? null,
    staffRoles: data?.staffRoles ?? [],
    isLoading,
    error: error ?? null,
    mutate,
  };
};
