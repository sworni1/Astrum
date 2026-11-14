import type { StaffRole } from "@/common/types/user.types";

/** The catalog keys that name the roles, so `useTranslations` keeps them typed. */
export type StaffRoleLabelKey = "roles.pointWorker" | "roles.courier";

/** The catalog key that names one role (spec 0017, AC-14). */
export const staffRoleLabelKey = (role: StaffRole): StaffRoleLabelKey =>
  role === "POINT_WORKER" ? "roles.pointWorker" : "roles.courier";

/** The page a held role opens. */
export const staffRoleHref = (role: StaffRole): string =>
  role === "POINT_WORKER" ? "/point" : "/courier";

/** The roles of an account in the fixed order the profile read answers them. */
export const heldRoles = (roles: StaffRole[]): StaffRole[] =>
  (["POINT_WORKER", "COURIER"] as const).filter((role) => roles.includes(role));
