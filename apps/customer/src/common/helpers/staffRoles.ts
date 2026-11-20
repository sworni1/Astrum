import type { StaffRole } from "@/common/types/user.types";

export type StaffRoleLabelKey = "roles.pointWorker" | "roles.courier";

export const staffRoleLabelKey = (role: StaffRole): StaffRoleLabelKey =>
  role === "POINT_WORKER" ? "roles.pointWorker" : "roles.courier";

export const staffRoleHref = (role: StaffRole): string =>
  role === "POINT_WORKER" ? "/point" : "/courier";

export const heldRoles = (roles: StaffRole[]): StaffRole[] =>
  (["POINT_WORKER", "COURIER"] as const).filter((role) => roles.includes(role));
