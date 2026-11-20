import { STAFF_ROLE_ORDER, type StaffRole } from "../types/staff.types";

type RoleRow = { pointWorker: object | null; courier: object | null };

export const staffRolesOf = (row: RoleRow): StaffRole[] =>
  STAFF_ROLE_ORDER.filter((role) =>
    role === "POINT_WORKER" ? Boolean(row.pointWorker) : Boolean(row.courier),
  );
