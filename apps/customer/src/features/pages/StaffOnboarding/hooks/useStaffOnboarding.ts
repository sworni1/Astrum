"use client";

import { useCallback, useState } from "react";
import type { StaffRole } from "@/common/types/user.types";
import type { StaffAnswer } from "@/hooks/staff/staff.types";

export type GrantedRole = { role: StaffRole; answer: StaffAnswer };

export type AcceptGrant = (
  role: StaffRole,
  answer: StaffAnswer,
) => Promise<void>;

export interface UseStaffOnboardingReturn {
  granted: GrantedRole | null;
  accept: AcceptGrant;
}

export const useStaffOnboarding = (
  revalidateProfile: () => Promise<unknown>,
): UseStaffOnboardingReturn => {
  const [granted, setGranted] = useState<GrantedRole | null>(null);

  const accept = useCallback<AcceptGrant>(
    async (role, answer) => {
      setGranted({ role, answer });
      await revalidateProfile();
    },
    [revalidateProfile],
  );

  return { granted, accept };
};
