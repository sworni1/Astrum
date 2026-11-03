import { ReviewStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../../lib/prisma";
import type { CreateReviewDto } from "./dto/create-review.dto";

export class ReviewsService {
  async createReview(userId: string, productId: string, dto: CreateReviewDto) {
    // D-06: Проверка покупки — OrderItem должен быть DELIVERED
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: dto.orderItemId },
    });

    if (!orderItem) {
      throw new Error("404: Order item not found");
    }

    const purchaseCheck = await prisma.orderItem.findFirst({
      where: {
        id: dto.orderItemId,
        userId,
        productId,
        status: "DELIVERED",
      },
    });

    if (!purchaseCheck) {
      throw new Error(
        "403: Review can only be created for delivered purchases",
      );
    }

    // D-07: Проверка уникальности — один отзыв на OrderItem
    const existing = await prisma.review.findUnique({
      where: { orderItemId: dto.orderItemId },
    });

    if (existing) {
      throw new Error("409: Review already exists for this order item");
    }

    // Создание отзыва со статусом PENDING (D-15)
    const review = await prisma.review.create({
      data: {
        userId,
        productId: dto.productId,
        orderItemId: dto.orderItemId,
        rating: dto.rating,
        qualityRating: dto.qualityRating,
        deliveryRating: dto.deliveryRating,
        accuracyRating: dto.accuracyRating,
        comment: dto.comment,
        photos: dto.photos ?? [],
        status: ReviewStatus.PENDING,
      },
    });

    return review;
  }

  async getReviewsForProduct(
    productId: string,
    query: { after?: string; limit?: number },
  ) {
    // D-14: только APPROVED отзывы, курсорная пагинация D-8, сортировка D-9
    const reviews = await prisma.review.findMany({
      where: { productId, status: ReviewStatus.APPROVED },
      take: query.limit || 20,
      skip: query.after ? 1 : 0,
      cursor: query.after ? { id: query.after } : undefined,
      orderBy: { createdAt: "desc" },
    });

    let nextCursor: string | null = null;
    if (reviews.length === (query.limit || 20)) {
      nextCursor = reviews[reviews.length - 1].id;
    }

    // D-14: Aggregate summary
    const aggregate = await prisma.review.aggregate({
      where: { productId, status: ReviewStatus.APPROVED },
      _count: { id: true },
      _avg: { rating: true },
    });

    return {
      reviews,
      nextCursor,
      hasNextPage: !!nextCursor,
      aggregate: {
        total: aggregate._count.id,
        averageRating: aggregate._avg.rating ?? 0,
      },
    };
  }

  async getReviewById(reviewId: string) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new Error("404: Review not found");
    }

    return review;
  }

  // D-11: Внутренний метод для обновления агрегатов (вызывается при модерации, Phase 3)
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
