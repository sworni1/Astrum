import { Gender } from "./auth.types";

export type UserData = {
  email: string;
  nickName: string;
  gender: Gender;
  dateOfBirth: Date;
};
