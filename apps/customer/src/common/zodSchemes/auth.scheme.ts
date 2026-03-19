import { z } from "zod";

export const signInFormSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .nonempty("Email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(25, "Password cannot exceed 25 characters"),
});

export const registerFormSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .nonempty("Email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(25, "Password cannot exceed 25 characters"),
  nickName: z
    .string()
    .max(25, "Nickname cannot exceed 25 characters")
    .optional(),
  dateOfBirth: z.date(),
  gender: z.enum(["Male", "Female"], {
    required_error: "Gender is required",
  }),
});
