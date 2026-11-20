import type { Gender } from "./auth.types";

export type UserStatus = "PENDING" | "ACTIVE";

export type StaffRole = "POINT_WORKER" | "COURIER";

export type UserData = {
  email: string;
  nickName: string;
  gender: Gender;
  dateOfBirth: Date;
  status: UserStatus;
  isSeller: boolean;
  staffRoles: StaffRole[];
};
