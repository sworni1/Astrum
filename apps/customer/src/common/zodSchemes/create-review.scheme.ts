import { z } from "zod";
import type { ValidationTranslator } from "./translator";

export const REVIEW_COMMENT_MIN_LENGTH = 5;
export const REVIEW_COMMENT_MAX_LENGTH = 2000;

const ratingField = (t: ValidationTranslator) =>
  z.number().min(1, t("ratingRequired")).max(5, t("ratingRequired"));

export const createReviewFormSchema = (t: ValidationTranslator) =>
  z.object({
    rating: ratingField(t),
    qualityRating: ratingField(t),
    deliveryRating: ratingField(t),
    accuracyRating: ratingField(t),

    comment: z
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

export type CreateReviewFormValues = z.infer<
  ReturnType<typeof createReviewFormSchema>
>;
