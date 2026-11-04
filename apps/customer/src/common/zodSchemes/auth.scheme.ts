import { differenceInYears } from "date-fns";
import { z } from "zod";

export const MIN_AGE_YEARS = 14;

export const signInFormSchema = z.object({
  email: z.email("Invalid email address").min(1, "Email is required"),
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
  dateOfBirth: z
    .date({ error: "Date of birth is required" })
    .refine((date) => differenceInYears(new Date(), date) >= MIN_AGE_YEARS, {
      message: `You must be at least ${MIN_AGE_YEARS} years old`,
    }),
  gender: z.enum(["Male", "Female"], {
    error: "Gender is required",
  }),
});
