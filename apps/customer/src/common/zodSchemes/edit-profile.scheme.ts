import { z } from "zod";

export const editProfileFormSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .nonempty("Email is required"),
  nickName: z
    .string()
    .max(25, "Nickname cannot exceed 25 characters")
    .optional(),
});
