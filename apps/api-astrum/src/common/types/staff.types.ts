import type { Request } from "express";

export type StaffRole = "POINT_WORKER" | "COURIER";

export const STAFF_ROLE_ORDER: readonly StaffRole[] = [
  "POINT_WORKER",
  "COURIER",
];

export type StaffPointView = {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
};

export type StaffRoleRow = {
  role: StaffRole;
  pickupPointId: string | null;
};

export type StaffRequest = Request & {
  userId: string;
  staff?: StaffRoleRow;
};
