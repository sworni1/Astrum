import { z } from "zod";
import type { ValidationTranslator } from "./translator";

export const SHOP_NAME_MIN_LENGTH = 2;
export const SHOP_NAME_MAX_LENGTH = 60;

const WHITESPACE_RUN = /\s+/gu;
const FORBIDDEN_CHARACTER = /[\p{Cc}\p{Cf}]/u;

/** NFC first, then trim, then collapse every whitespace run to one space (spec 0008, AC-6). */
export const normalizeShopName = (value: string): string =>
  value.normalize("NFC").trim().replace(WHITESPACE_RUN, " ");

export type ShopNameProblem = "required" | "tooShort" | "tooLong" | "forbidden";

export const shopNameProblem = (value: string): ShopNameProblem | null => {
  if (value.trim() === "") {
    return "required";
  }

  const length = [...value].length;

  if (length < SHOP_NAME_MIN_LENGTH) {
    return "tooShort";
  }

  if (length > SHOP_NAME_MAX_LENGTH) {
    return "tooLong";
  }

  if (FORBIDDEN_CHARACTER.test(value)) {
    return "forbidden";
  }

  return null;
};

const PROBLEM_MESSAGE = {
  required: "shopNameRequired",
  tooShort: "shopNameTooShort",
  tooLong: "shopNameTooLong",
  forbidden: "shopNameForbidden",
} as const;

export const createShopNameSchema = (t: ValidationTranslator) =>
  z.object({
    name: z
      .string()
      .transform(normalizeShopName)
      .superRefine((value, ctx) => {
        const problem = shopNameProblem(value);

        if (problem) {
          ctx.addIssue({
            code: "custom",
            message: t(PROBLEM_MESSAGE[problem]),
          });
        }
      }),
  });

export type ShopNameForm = z.input<ReturnType<typeof createShopNameSchema>>;
