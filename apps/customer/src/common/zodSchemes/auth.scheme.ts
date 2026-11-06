import { differenceInYears } from "date-fns";
import { z } from "zod";
import type { ValidationTranslator } from "./translator";

export const MIN_AGE_YEARS = 14;

export const createSignInFormSchema = (t: ValidationTranslator) =>
  z.object({
    email: z.email(t("emailInvalid")).min(1, t("emailRequired")),
    password: z
      .string()
      .min(8, t("passwordTooShort"))
      .max(25, t("passwordTooLong")),
  });

export const createRegisterFormSchema = (t: ValidationTranslator) =>
  z.object({
    email: z.string().email(t("emailInvalid")).nonempty(t("emailRequired")),
    password: z
      .string()
      .min(8, t("passwordTooShort"))
      .max(25, t("passwordTooLong")),
    nickName: z.string().max(25, t("nicknameTooLong")).optional(),
    dateOfBirth: z
      .date({ error: t("dateOfBirthRequired") })
      .refine((date) => differenceInYears(new Date(), date) >= MIN_AGE_YEARS, {
        message: t("minAge", { age: MIN_AGE_YEARS }),
      }),
    gender: z.enum(["Male", "Female"], {
      error: t("genderRequired"),
    }),
  });
