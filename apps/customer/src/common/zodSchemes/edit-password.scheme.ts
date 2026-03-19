import { z } from "zod";

export const editPasswordFormSchema = z.object({
  oldPassword: z
    .string()
    .min(8, "Old password must be at least 8 characters")
    .max(25, "Old password cannot exceed 25 characters"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(25, "New password cannot exceed 25 characters"),
});
