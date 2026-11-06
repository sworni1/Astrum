import { z } from "zod";
import type { ValidationTranslator } from "./translator";

export const createEditProfileFormSchema = (t: ValidationTranslator) =>
  z.object({
    email: z.email(t("emailInvalid")).min(1, t("emailRequired")),
    nickName: z.string().max(25, t("nicknameTooLong")).optional(),
  });
