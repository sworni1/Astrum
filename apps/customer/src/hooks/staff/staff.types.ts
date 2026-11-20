import type { StaffRole } from "@/common/types/user.types";

export type StaffPoint = {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
};

export type StaffAnswer = {
  staffRoles: StaffRole[];
  point: StaffPoint | null;
};

export const hasRole = (roles: StaffRole[], role: StaffRole): boolean =>
  roles.includes(role);
