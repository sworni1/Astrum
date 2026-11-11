import { Prisma } from "../../../generated/prisma/client";
import { OrderItemStatus, ReviewStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import type { CreateReviewDto } from "./dto/create-review.dto";
import {
  REVIEW_ERROR_CODES,
  REVIEW_PAGE_DEFAULT_LIMIT,
  REVIEW_PAGE_MAX_LIMIT,
} from "./reviews.constants";
import {
  buildDistribution,
  roundAverageRating,
  reviewRowSelect,
  serializeReview,
  type ReviewRow,
} from "./review.serializer";

export type ReviewPageQuery = {
  after?: unknown;
  limit?: unknown;
};

/** An integer clamped to 1 through 50, defaulting to 20 (AC-12). */
const parseLimit = (raw: unknown): number => {
  if (raw === undefined) {
    return REVIEW_PAGE_DEFAULT_LIMIT;
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
    const limit = parseLimit(query.limit);
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
