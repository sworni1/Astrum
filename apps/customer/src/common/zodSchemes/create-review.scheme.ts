import { z } from "zod";
import type { ValidationTranslator } from "./translator";

/** The DTO bounds, mirrored so the browser refuses before the server does. */
export const REVIEW_COMMENT_MIN_LENGTH = 5;
export const REVIEW_COMMENT_MAX_LENGTH = 2000;

const ratingField = (t: ValidationTranslator) =>
  z
    .number()
    .min(1, t("ratingRequired"))
    .max(5, t("ratingRequired"));

export const createReviewFormSchema = (t: ValidationTranslator) =>
  z.object({
    rating: ratingField(t),
    qualityRating: ratingField(t),
    deliveryRating: ratingField(t),
    accuracyRating: ratingField(t),
    // The trim runs first, and the length is counted in UTF-16 units, which is
    // what the server's MinLength counts, so an emoji weighs two on both sides.
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
