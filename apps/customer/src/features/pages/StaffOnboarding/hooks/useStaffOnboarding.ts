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

/**
 * The card a successful action shows for the rest of the page visit, and the
 * profile revalidation that puts the new role in the navigation (AC-3, AC-12).
 */
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
