import type { StaffRole } from "@/common/types/user.types";

/** The point an answer carries; `isActive` false means it is switched off. */
export type StaffPoint = {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
};

/** What every staff endpoint answers (spec 0017). */
export type StaffAnswer = {
  staffRoles: StaffRole[];
  point: StaffPoint | null;
};

export const hasRole = (roles: StaffRole[], role: StaffRole): boolean =>
  roles.includes(role);
