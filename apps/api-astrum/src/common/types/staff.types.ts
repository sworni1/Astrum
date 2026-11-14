import type { Request } from "express";

/** The two jobs an account can hold; a person may hold both (spec 0017). */
export type StaffRole = "POINT_WORKER" | "COURIER";

/**
 * The order every answer lists the roles in (AC-11). One table, so the gateway
 * and the screens cannot drift apart on it.
 */
export const STAFF_ROLE_ORDER: readonly StaffRole[] = [
  "POINT_WORKER",
  "COURIER",
];

/** The point a grant and a read answer with. */
export type StaffPointView = {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
};

/** What the role guards put on the request, so no handler re-reads the role. */
export type StaffRoleRow = {
  role: StaffRole;
  pickupPointId: string | null;
};

export type StaffRequest = Request & {
  userId: string;
  staff?: StaffRoleRow;
};
