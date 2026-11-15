import type {
  Product,
  ProductCategory,
} from "../../../generated/prisma/client";
import { ReviewStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import { getWishlistAndCartItem } from "../../common/helpers/getWishlistAndCart";
import {
  productPreviewPublicSelect,
  productPublicSelect,
} from "../../common/prisma-selects/product.select";
import { roundAverageRating } from "../reviews/review.serializer";
import { readReviewState } from "../reviews/review-state";
import type { CreateProductDto } from "./dto/create-product.dto";

type ProductRating = { averageRating: number; reviewCount: number };

/**
 * The rating of every product on one page, from the reviews a customer may read.
 * One grouped query for the whole page, never one per card (spec 0021, AC-3).
 */
const readPageRatings = async (
  productIds: Product["id"][],
): Promise<Map<Product["id"], ProductRating>> => {
  if (productIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.review.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, status: ReviewStatus.APPROVED },
    _count: { _all: true },
    _avg: { rating: true },
  });

  return new Map(
    rows.map((row) => [
      row.productId,
      {
        averageRating: roundAverageRating(row._avg.rating),
        reviewCount: row._count._all,
      },
    ]),
  );
};

export class ProductService {
  async getProduct(userId: string, productId: Product["id"]) {
    const { wishlistItem, cartItem } = await getWishlistAndCartItem(
      userId,
      productId,
    );

    const product = await prisma.product.findUnique({
      where: {
        id: productId,
        isDeleted: false,
        visibility: "Public",
        status: "Published",
      },
      select: productPublicSelect,
    });

    if (!product) {
      throw new Error("Product not found");
    }

    const reviewState = await readReviewState(userId, productId);

    const { properties, ...rest } = product;

    return {
      ...rest,
      images: rest.images ?? [],
      properties: properties ?? [],
      isWishlisted: !!wishlistItem,
      isOutOfStock: product.isOutOfStock,
      quantityInCart: cartItem ? cartItem.quantity : 0,
      reviewState,
    };
  }

  async getRecommendations(
    userId: string,
    filters?: {
      category?: ProductCategory;
      search_query?: string;
    },
    cursor?: string,
    limit: number = 8,
  ) {
    const products = await prisma.product.findMany({
      where: {
        isDeleted: false,
        visibility: "Public",
        status: "Published",
        ...(filters?.category ? { category: filters.category } : {}),
        ...(filters?.search_query
          ? {
              name: { contains: filters.search_query, mode: "insensitive" },
            }
          : {}),
      },
      select: productPreviewPublicSelect,
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor
        ? {
            id: cursor,
          }
        : undefined,
    });

    let nextCursor = null;

    if (products.length === limit) {
      nextCursor = products[products.length - 1].id;
    }

    const ratings = await readPageRatings(
      products.map((product) => product.id),
    );

    const productsWithData = await Promise.all(
      products.map(async (product) => {
        const { wishlistItem, cartItem } = await getWishlistAndCartItem(
          userId,
          product.id,
        );

        const rating = ratings.get(product.id);

        return {
          ...product,
          averageRating: rating?.averageRating ?? 0,
          reviewCount: rating?.reviewCount ?? 0,
          isWishlisted: !!wishlistItem,
          quantityInCart: cartItem ? cartItem.quantity : 0,
        };
      }),
    );

    return {
      products: productsWithData,
      nextCursor,
      hasNextPage: !!nextCursor,
    };
  }

  getCategoryProducts = this.getRecommendations;

  async createProduct(userId: string, dto: CreateProductDto) {
    const business = await prisma.business.findUnique({
      where: { ownerUserId: userId },
      select: { id: true },
    });

    if (!business) {
      throw new AppError(
        403,
        "SELLER_NOT_ASSIGNED",
        "No business is assigned to this seller.",
      );
    }

    const product = await prisma.product.create({
      data: { ...dto, businessId: business.id },
    });

    return product;
  }
}
