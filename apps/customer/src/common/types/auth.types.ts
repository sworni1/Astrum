import type { z } from "zod";
import type { createRegisterFormSchema } from "../zodSchemes/auth.scheme";

export enum Gender {
  Male,
  Female,
}

// Single source of truth: the zod schema the register form validates against.
export type SignUpCredentials = z.infer<
  ReturnType<typeof createRegisterFormSchema>
>;

export type SignInCredentials = {
  email: string;
  password: string;
};
