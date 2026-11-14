import { STAFF_ROLE_ORDER, type StaffRole } from "../types/staff.types";

/** Any `User` row read with both role relations selected. */
type RoleRow = { pointWorker: object | null; courier: object | null };

/** The roles an account holds, in the one order the product lists them in (spec 0017, AC-11). */
export const staffRolesOf = (row: RoleRow): StaffRole[] =>
  STAFF_ROLE_ORDER.filter((role) =>
    role === "POINT_WORKER" ? Boolean(row.pointWorker) : Boolean(row.courier),
  );
