import { z } from "zod";

export const editProfileFormSchema = z.object({
  email: z.email("Invalid email address").min(1, "Email is required"),
  nickName: z
    .string()
    .max(25, "Nickname cannot exceed 25 characters")
    .optional(),
});
