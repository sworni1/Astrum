import { ReviewStatus } from "@astrum/db/enums";
import { prisma } from "../../../lib/prisma";
import type { Owner } from "../../common/types/owner";
import {
  requireApprovedReview,
  requireReview,
} from "./helpers/reviews.helpers";
import type { LikeAnswer } from "./types/reviews.types";

export const readLikedReviewIds = async (
  owner: Owner | null,
  productId: string,
): Promise<{ reviewIds: string[] }> => {
  if (!owner || owner.kind !== "user") {
    return { reviewIds: [] };
  }

  const rows = await prisma.reviewLike.findMany({
    where: {
      userId: owner.userId,
      Review: { productId, status: ReviewStatus.APPROVED },
    },
    select: { reviewId: true },
    orderBy: { createdAt: "asc" },
  });

  return { reviewIds: rows.map((row) => row.reviewId) };
};

export const applyLike = async (
  userId: string,
  reviewId: string,
): Promise<{ answer: LikeAnswer; productId: string }> =>
  await prisma.$transaction(async (tx) => {
    const review = await requireApprovedReview(tx, reviewId);

    const created = await tx.reviewLike.createMany({
      data: [{ reviewId, userId }],
      skipDuplicates: true,
    });

    if (created.count === 1) {
      const updated = await tx.review.update({
        where: { id: reviewId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });

      return {
        answer: { liked: true, likeCount: updated.likeCount },
        productId: review.productId,
      };
    }

    const current = await tx.review.findUnique({
      where: { id: reviewId },
      select: { likeCount: true },
    });

    return {
      answer: { liked: true, likeCount: current?.likeCount ?? 0 },
      productId: review.productId,
    };
  });

export const applyUnlike = async (
  userId: string,
  reviewId: string,
): Promise<{ answer: LikeAnswer; productId: string }> =>
  await prisma.$transaction(async (tx) => {
    const review = await requireReview(tx, reviewId);

    const removed = await tx.reviewLike.deleteMany({
      where: { reviewId, userId },
    });

    if (removed.count === 1) {
      await tx.review.updateMany({
        where: { id: reviewId, likeCount: { gt: 0 } },
        data: { likeCount: { decrement: 1 } },
      });
    }

    const current = await tx.review.findUnique({
      where: { id: reviewId },
      select: { likeCount: true },
    });

    return {
      answer: { liked: false, likeCount: current?.likeCount ?? 0 },
      productId: review.productId,
    };
  });
