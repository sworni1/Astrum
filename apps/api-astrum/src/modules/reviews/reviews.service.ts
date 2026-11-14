import { Prisma } from "../../../generated/prisma/client";
import { OrderItemStatus, ReviewStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import type { CreateReviewCommentDto } from "./dto/create-review-comment.dto";
import type { CreateReviewDto } from "./dto/create-review.dto";
import {
  REVIEW_COMMENT_PAGE_DEFAULT_LIMIT,
  REVIEW_COMMENT_RATE_LIMIT,
  REVIEW_COMMENT_RATE_WINDOW_MS,
  REVIEW_ERROR_CODES,
  REVIEW_PAGE_DEFAULT_LIMIT,
  REVIEW_PAGE_MAX_LIMIT,
} from "./constants/reviews.constants";
import {
  buildDistribution,
  reviewCommentSelect,
  reviewRowSelect,
  roundAverageRating,
  serializeReview,
  serializeReviewComment,
  type PublicReviewComment,
  type ReviewCommentRow,
  type ReviewRow,
} from "./review.serializer";

export type ReviewPageQuery = {
  after?: unknown;
  limit?: unknown;
};

export type LikeAnswer = {
  liked: boolean;
  likeCount: number;
};

export type CommentPage = {
  comments: PublicReviewComment[];
  nextCursor: string | null;
  hasNextPage: boolean;
};

export type CommentWriteAnswer = {
  comment: PublicReviewComment;
  commentCount: number;
};

/** A transaction handle, so a guard reads the same snapshot as the write. */
type Tx = Prisma.TransactionClient;

/** An integer clamped to 1 through 50, defaulting to the caller's page size. */
const parseLimit = (raw: unknown, fallback: number): number => {
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

export class ReviewsService {
  async createReview(userId: string, productId: string, dto: CreateReviewDto) {
    // The purchase proof and the written row name the same product: the line is
    // looked up inside this customer's own lines (spec 0012, AC-11).
    const orderItem = await prisma.orderItem.findFirst({
      where: { id: dto.orderItemId, userId },
      select: { id: true, productId: true, status: true },
    });

    if (!orderItem) {
      throw new AppError(
        404,
        REVIEW_ERROR_CODES.orderItemNotFound,
        "Order item not found",
      );
    }

    if (orderItem.productId !== productId) {
      throw new AppError(
        403,
        REVIEW_ERROR_CODES.productMismatch,
        "The order item belongs to another product",
      );
    }

    if (orderItem.status !== OrderItemStatus.DELIVERED) {
      throw new AppError(
        403,
        REVIEW_ERROR_CODES.onlyAfterDelivery,
        "Review can only be created for delivered purchases",
      );
    }

    try {
      const row = await prisma.review.create({
        data: {
          userId,
          productId,
          orderItemId: orderItem.id,
          rating: dto.rating,
          qualityRating: dto.qualityRating,
          deliveryRating: dto.deliveryRating,
          accuracyRating: dto.accuracyRating,
          comment: dto.comment.trim(),
          photos: dto.photos ?? [],
          status: ReviewStatus.APPROVED,
        },
        select: reviewRowSelect,
      });

      return serializeReview(row as ReviewRow);
    } catch (error) {
      // The unique index on orderItemId decides the race: one 201, one 409.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError(
          409,
          REVIEW_ERROR_CODES.alreadyExists,
          "Review already exists for this order item",
        );
      }

      throw error;
    }
  }

  async getReviewsForProduct(productId: string, query: ReviewPageQuery = {}) {
    const limit = parseLimit(query.limit, REVIEW_PAGE_DEFAULT_LIMIT);
    const after = query.after === undefined ? undefined : String(query.after);

    if (after !== undefined) {
      const cursorRow = await prisma.review.findFirst({
        where: { id: after, productId, status: ReviewStatus.APPROVED },
        select: { id: true },
      });

      if (!cursorRow) {
        throw new AppError(
          400,
          REVIEW_ERROR_CODES.invalidCursor,
          "after must be a review of this product",
        );
      }
    }

    const where = { productId, status: ReviewStatus.APPROVED };

    const [rows, total, average, ratingGroups] = await Promise.all([
      prisma.review.findMany({
        where,
        take: limit + 1,
        ...(after ? { cursor: { id: after }, skip: 1 } : {}),
        // createdAt alone is not unique, and a cursor over a non unique sort
        // both repeats and skips rows (AC-12).
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: reviewRowSelect,
      }),
      prisma.review.count({ where }),
      prisma.review.aggregate({ where, _avg: { rating: true } }),
      prisma.review.groupBy({
        by: ["rating"],
        where,
        _count: { _all: true },
      }),
    ]);

    const hasNextPage = rows.length > limit;
    const page = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage ? page[page.length - 1].id : null;

    return {
      reviews: page.map((row) => serializeReview(row as ReviewRow)),
      nextCursor,
      hasNextPage,
      aggregate: {
        total,
        averageRating: roundAverageRating(average._avg.rating as number | null),
        distribution: buildDistribution(
          ratingGroups.map((group) => ({
            rating: group.rating,
            count: group._count._all,
          })),
        ),
      },
    };
  }

  async getReviewById(reviewId: string) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new AppError(404, REVIEW_ERROR_CODES.notFound, "Review not found");
    }

    return review;
  }

  /**
   * The ids of this product's approved reviews the caller liked, oldest like
   * first (AC-3). An empty array covers a product with nothing liked in it, so
   * the screen never reads a `404` as "nobody liked anything".
   */
  async getLikedReviewIds(
    userId: string,
    productId: string,
  ): Promise<{ reviewIds: string[] }> {
    const rows = await prisma.reviewLike.findMany({
      where: {
        userId,
        Review: { productId, status: ReviewStatus.APPROVED },
      },
      select: { reviewId: true },
      orderBy: { createdAt: "asc" },
    });

    return { reviewIds: rows.map((row) => row.reviewId) };
  }

  /**
   * One like per review and customer. The insert itself is the guard, so a
   * repeated press answers the same number instead of a `500` (AC-4).
   */
  async likeReview(userId: string, reviewId: string): Promise<LikeAnswer> {
    return prisma.$transaction(async (tx) => {
      await this.requireApprovedReview(tx, reviewId);

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

        return { liked: true, likeCount: updated.likeCount };
      }

      const current = await tx.review.findUnique({
        where: { id: reviewId },
        select: { likeCount: true },
      });

      return { liked: true, likeCount: current?.likeCount ?? 0 };
    });
  }

  /**
   * Decrements only when exactly one row was removed, so a repeat answers the
   * same number and the counter never reads `-1` (AC-4).
   */
  async unlikeReview(userId: string, reviewId: string): Promise<LikeAnswer> {
    return prisma.$transaction(async (tx) => {
      await this.requireReview(tx, reviewId);

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

      return { liked: false, likeCount: current?.likeCount ?? 0 };
    });
  }

  /** One page of the flat thread, oldest first, ten rows by default (AC-7). */
  async getReviewComments(
    reviewId: string,
    viewerId: string,
    query: ReviewPageQuery = {},
  ): Promise<CommentPage> {
    const review = await prisma.review.findFirst({
      where: { id: reviewId, status: ReviewStatus.APPROVED },
      select: { id: true },
    });

    if (!review) {
      throw new AppError(404, REVIEW_ERROR_CODES.notFound, "Review not found");
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
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
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
  }

  /**
   * The budget and the insert read and write one snapshot, so the eleventh
   * comment in the hour is refused and a failed insert leaves the counter
   * untouched (AC-8, AC-9).
   */
  async createReviewComment(
    userId: string,
    reviewId: string,
    dto: CreateReviewCommentDto,
  ): Promise<CommentWriteAnswer> {
    const body = dto.body.trim();

    return prisma.$transaction(async (tx) => {
      await this.requireApprovedReview(tx, reviewId);

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
        comment: serializeReviewComment(row as ReviewCommentRow, userId),
        commentCount: updated.commentCount,
      };
    });
  }

  /**
   * The author's own soft delete: the update is guarded by `deletedAt: null`,
   * so a repeat answers the identical stub and decrements once (AC-10).
   */
  async deleteReviewComment(
    userId: string,
    reviewId: string,
    commentId: string,
  ): Promise<CommentWriteAnswer> {
    return prisma.$transaction(async (tx) => {
      await this.requireReview(tx, reviewId);

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
        comment: serializeReviewComment(row as ReviewCommentRow, userId),
        commentCount: counter?.commentCount ?? 0,
      };
    });
  }

  /**
   * A like or a comment needs an approved review; both delete routes act on
   * existence alone, so a row written before a status change can be withdrawn
   * (AC-5).
   */
  private async requireApprovedReview(tx: Tx, reviewId: string): Promise<void> {
    const review = await tx.review.findFirst({
      where: { id: reviewId, status: ReviewStatus.APPROVED },
      select: { id: true },
    });

    if (!review) {
      throw new AppError(404, REVIEW_ERROR_CODES.notFound, "Review not found");
    }
  }

  private async requireReview(tx: Tx, reviewId: string): Promise<void> {
    const review = await tx.review.findFirst({
      where: { id: reviewId },
      select: { id: true },
    });

    if (!review) {
      throw new AppError(404, REVIEW_ERROR_CODES.notFound, "Review not found");
    }
  }

  // Kept for a future moderation write; nothing calls it today (spec 0012, Follow up).
  async updateProductAggregates(productId: string) {
    await prisma.$transaction(async (tx) => {
      const aggregate = await tx.review.aggregate({
        where: { productId, status: ReviewStatus.APPROVED },
        _count: { id: true },
        _avg: { rating: true },
      });

      await tx.product.update({
        where: { id: productId },
        data: {
          reviewCount: aggregate._count.id || 0,
          averageRating: Number(aggregate._avg.rating) || 0,
        },
      });
    });
  }
}
