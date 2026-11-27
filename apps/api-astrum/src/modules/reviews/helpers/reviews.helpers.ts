import type { Prisma } from "@astrum/db/client";
import { ReviewStatus } from "@astrum/db/enums";
import { AppError } from "../../../common/helpers/appError";
import {
  REVIEW_ERROR_CODES,
  REVIEW_PAGE_MAX_LIMIT,
} from "../constants/reviews.constants";

export type Tx = Prisma.TransactionClient;

export const reviewNotFound = (): AppError =>
  new AppError(404, REVIEW_ERROR_CODES.notFound, "Review not found");

export const parseLimit = (raw: unknown, fallback: number): number => {
  if (raw === undefined) {
    return fallback;
  }

  const value = typeof raw === "number" ? raw : Number(raw);

  if (!Number.isInteger(value)) {
    throw new AppError(
      400,
      REVIEW_ERROR_CODES.invalidPagination,
      "limit must be an integer",
    );
  }

  return Math.min(Math.max(value, 1), REVIEW_PAGE_MAX_LIMIT);
};

export const requireApprovedReview = async (
  tx: Tx,
  reviewId: string,
): Promise<{ id: string; productId: string }> => {
  const review = await tx.review.findFirst({
    where: { id: reviewId, status: ReviewStatus.APPROVED },
    select: { id: true, productId: true },
  });

  if (!review) {
    throw reviewNotFound();
  }

  return review;
};

export const requireReview = async (
  tx: Tx,
  reviewId: string,
): Promise<{ id: string; productId: string }> => {
  const review = await tx.review.findFirst({
    where: { id: reviewId },
    select: { id: true, productId: true },
  });

  if (!review) {
    throw reviewNotFound();
  }

  return review;
};
