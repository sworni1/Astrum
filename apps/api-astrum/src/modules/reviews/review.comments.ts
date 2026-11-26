import { ReviewStatus } from "@astrum/db/enums";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import {
  REVIEW_COMMENT_ORDER_BY,
  REVIEW_COMMENT_PAGE_DEFAULT_LIMIT,
  REVIEW_COMMENT_RATE_LIMIT,
  REVIEW_COMMENT_RATE_WINDOW_MS,
  REVIEW_ERROR_CODES,
} from "./constants/reviews.constants";
import type { CreateReviewCommentDto } from "./dto/create-review-comment.dto";
import {
  parseLimit,
  requireApprovedReview,
  requireReview,
  reviewNotFound,
} from "./helpers/reviews.helpers";
import {
  type ReviewCommentRow,
  reviewCommentSelect,
  serializeReviewComment,
} from "./review.serializer";
import type {
  CommentPage,
  CommentWriteAnswer,
  ReviewPageQuery,
} from "./types/reviews.types";

export const readCommentPage = async (
  reviewId: string,
  viewerId: string,
  query: ReviewPageQuery,
): Promise<CommentPage> => {
  const review = await prisma.review.findFirst({
    where: { id: reviewId, status: ReviewStatus.APPROVED },
    select: { id: true },
  });

  if (!review) {
    throw reviewNotFound();
  }

  const limit = parseLimit(query.limit, REVIEW_COMMENT_PAGE_DEFAULT_LIMIT);
  const after = query.after === undefined ? undefined : String(query.after);

  if (after !== undefined) {
    const cursorRow = await prisma.reviewComment.findFirst({
      where: { id: after, reviewId },
      select: { id: true },
    });

    if (!cursorRow) {
      throw new AppError(
        400,
        REVIEW_ERROR_CODES.invalidCursor,
        "after must be a comment of this review",
      );
    }
  }

  const rows = await prisma.reviewComment.findMany({
    where: { reviewId },
    take: limit + 1,
    ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    orderBy: REVIEW_COMMENT_ORDER_BY,
    select: reviewCommentSelect,
  });

  const hasNextPage = rows.length > limit;
  const page = hasNextPage ? rows.slice(0, limit) : rows;

  return {
    comments: page.map((row) =>
      serializeReviewComment(row as ReviewCommentRow, viewerId),
    ),
    nextCursor: hasNextPage ? page[page.length - 1].id : null,
    hasNextPage,
  };
};

export const applyCommentCreate = async (
  userId: string,
  reviewId: string,
  dto: CreateReviewCommentDto,
): Promise<{ answer: CommentWriteAnswer; productId: string }> => {
  const body = dto.body.trim();

  return await prisma.$transaction(async (tx) => {
    const review = await requireApprovedReview(tx, reviewId);

    const windowStart = new Date(Date.now() - REVIEW_COMMENT_RATE_WINDOW_MS);
    const recent = await tx.reviewComment.count({
      where: { userId, createdAt: { gte: windowStart } },
    });

    if (recent >= REVIEW_COMMENT_RATE_LIMIT) {
      throw new AppError(
        429,
        REVIEW_ERROR_CODES.commentRateLimited,
        "Too many comments in the last hour",
      );
    }

    const row = await tx.reviewComment.create({
      data: { reviewId, userId, body },
      select: reviewCommentSelect,
    });

    const updated = await tx.review.update({
      where: { id: reviewId },
      data: { commentCount: { increment: 1 } },
      select: { commentCount: true },
    });

    return {
      answer: {
        comment: serializeReviewComment(row as ReviewCommentRow, userId),
        commentCount: updated.commentCount,
      },
      productId: review.productId,
    };
  });
};

export const applyCommentDelete = async (
  userId: string,
  reviewId: string,
  commentId: string,
): Promise<{ answer: CommentWriteAnswer; productId: string }> =>
  await prisma.$transaction(async (tx) => {
    const review = await requireReview(tx, reviewId);

    const existing = await tx.reviewComment.findFirst({
      where: { id: commentId, reviewId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      throw new AppError(
        404,
        REVIEW_ERROR_CODES.commentNotFound,
        "Comment not found",
      );
    }

    if (existing.userId !== userId) {
      throw new AppError(
        403,
        REVIEW_ERROR_CODES.commentForbidden,
        "Only the author can delete this comment",
      );
    }

    const updated = await tx.reviewComment.updateMany({
      where: { id: commentId, reviewId, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    if (updated.count === 1) {
      await tx.review.updateMany({
        where: { id: reviewId, commentCount: { gt: 0 } },
        data: { commentCount: { decrement: 1 } },
      });
    }

    const row = await tx.reviewComment.findUnique({
      where: { id: commentId },
      select: reviewCommentSelect,
    });
    const counter = await tx.review.findUnique({
      where: { id: reviewId },
      select: { commentCount: true },
    });

    return {
      answer: {
        comment: serializeReviewComment(row as ReviewCommentRow, userId),
        commentCount: counter?.commentCount ?? 0,
      },
      productId: review.productId,
    };
  });
