import type { z } from "zod";
import type { registerFormSchema } from "../zodSchemes/auth.scheme";

export enum Gender {
  Male,
  Female,
}

// Single source of truth: the zod schema the register form validates against.
export type SignUpCredentials = z.infer<typeof registerFormSchema>;

export type SignInCredentials = {
  email: string;
  password: string;
};
