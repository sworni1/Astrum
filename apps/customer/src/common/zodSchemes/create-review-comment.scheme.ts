import { z } from "zod";
import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_COMMENT_MIN_LENGTH,
} from "./create-review.scheme";
import type { ValidationTranslator } from "./translator";

/**
 * The same bounds the DTO enforces, mirrored so the browser refuses before the
 * server does. The trim runs first, and the length is counted in UTF-16 units,
 * which is what the server counts too (spec 0014, AC-8).
 */
export const createReviewCommentFormSchema = (t: ValidationTranslator) =>
  z.object({
    body: z
      .string()
      .trim()
      .refine(
        (value) => value.length >= REVIEW_COMMENT_MIN_LENGTH,
        t("commentTooShort"),
      )
      .refine(
        (value) => value.length <= REVIEW_COMMENT_MAX_LENGTH,
        t("commentTooLong"),
      ),
  });

export type CreateReviewCommentFormValues = z.infer<
  ReturnType<typeof createReviewCommentFormSchema>
>;
