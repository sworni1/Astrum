import { z } from "zod";
import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_COMMENT_MIN_LENGTH,
} from "./create-review.scheme";
import type { ValidationTranslator } from "./translator";

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
