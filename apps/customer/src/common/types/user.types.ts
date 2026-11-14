import type { Gender } from "./auth.types";

export type UserStatus = "PENDING" | "ACTIVE";

/** The two jobs an account can hold (spec 0017). */
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
