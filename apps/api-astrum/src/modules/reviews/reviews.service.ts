import { Prisma } from "@astrum/db/client";
import { OrderItemStatus, ReviewStatus } from "@astrum/db/enums";
import { prisma } from "../../../lib/prisma";
import {
  getOrSet,
  invalidateLists,
  invalidateReviews,
  productTtlSeconds,
  readVersion,
} from "../../cache/cache";
import { cacheKeys } from "../../cache/cacheKeys";
import { AppError } from "../../common/helpers/appError";
import type { Owner } from "../../common/types/owner";
import {
  REVIEW_ERROR_CODES,
  REVIEW_PAGE_DEFAULT_LIMIT,
} from "./constants/reviews.constants";
import type { CreateReviewDto } from "./dto/create-review.dto";
import type { CreateReviewCommentDto } from "./dto/create-review-comment.dto";
import { parseLimit, reviewNotFound } from "./helpers/reviews.helpers";
import {
  applyCommentCreate,
  applyCommentDelete,
  readCommentPage,
} from "./review.comments";
import { applyLike, applyUnlike, readLikedReviewIds } from "./review.likes";
import { loadReviewPage } from "./review.list";
import {
  type ReviewRow,
  reviewRowSelect,
  serializeReview,
} from "./review.serializer";
import type {
  CommentPage,
  CommentWriteAnswer,
  LikeAnswer,
  ReviewPageQuery,
} from "./types/reviews.types";

export type {
  CommentPage,
  CommentWriteAnswer,
  LikeAnswer,
  ReviewPageQuery,
} from "./types/reviews.types";

export class ReviewsService {
  async createReview(userId: string, productId: string, dto: CreateReviewDto) {
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

    if (orderItem.status !== OrderItemStatus.ISSUED) {
      throw new AppError(
        403,
        REVIEW_ERROR_CODES.onlyAfterDelivery,
        "Review can only be created for purchases the buyer was handed",
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

      await invalidateLists();
      await invalidateReviews(productId);

      return serializeReview(row as ReviewRow);
    } catch (error) {
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
    const revision = await readVersion(cacheKeys.reviewsVersion(productId));

    return await getOrSet({
      key: cacheKeys.reviews(productId, revision, limit, after),
      ttlSeconds: productTtlSeconds(),
      load: async () => await loadReviewPage(productId, limit, after),
    });
  }

  async getReviewById(reviewId: string) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw reviewNotFound();
    }

    return review;
  }

  async getLikedReviewIds(
    owner: Owner | null,
    productId: string,
  ): Promise<{ reviewIds: string[] }> {
    return await readLikedReviewIds(owner, productId);
  }

  async likeReview(userId: string, reviewId: string): Promise<LikeAnswer> {
    const { answer, productId } = await applyLike(userId, reviewId);

    await invalidateReviews(productId);

    return answer;
  }

  async unlikeReview(userId: string, reviewId: string): Promise<LikeAnswer> {
    const { answer, productId } = await applyUnlike(userId, reviewId);

    await invalidateReviews(productId);

    return answer;
  }

  async getReviewComments(
    reviewId: string,
    viewerId: string,
    query: ReviewPageQuery = {},
  ): Promise<CommentPage> {
    return await readCommentPage(reviewId, viewerId, query);
  }

  async createReviewComment(
    userId: string,
    reviewId: string,
    dto: CreateReviewCommentDto,
  ): Promise<CommentWriteAnswer> {
    const { answer, productId } = await applyCommentCreate(
      userId,
      reviewId,
      dto,
    );

    await invalidateReviews(productId);

    return answer;
  }

  async deleteReviewComment(
    userId: string,
    reviewId: string,
    commentId: string,
  ): Promise<CommentWriteAnswer> {
    const { answer, productId } = await applyCommentDelete(
      userId,
      reviewId,
      commentId,
    );

    await invalidateReviews(productId);

    return answer;
  }

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
