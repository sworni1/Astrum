import type { z } from "zod";
import type { createRegisterFormSchema } from "@/common/zodSchemes/auth.scheme";

export enum Gender {
  Male,
  Female,
}

export type SignUpCredentials = z.infer<
  ReturnType<typeof createRegisterFormSchema>
>;

export type SignInCredentials = {
  email: string;
  password: string;
};
