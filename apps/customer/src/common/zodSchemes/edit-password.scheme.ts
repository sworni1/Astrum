import { z } from "zod";
import type { ValidationTranslator } from "./translator";

export const createEditPasswordFormSchema = (t: ValidationTranslator) =>
  z.object({
    oldPassword: z
      .string()
      .min(8, t("oldPasswordTooShort"))
      .max(25, t("oldPasswordTooLong")),
    newPassword: z
      .string()
      .min(8, t("newPasswordTooShort"))
      .max(25, t("newPasswordTooLong")),
  });
