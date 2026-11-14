import type {
  Product,
  ProductCategory,
} from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import { getWishlistAndCartItem } from "../../common/helpers/getWishlistAndCart";
import {
  productPreviewPublicSelect,
  productPublicSelect,
} from "../../common/prisma-selects/product.select";
import { readReviewState } from "../reviews/review-state";
import type { CreateProductDto } from "./dto/create-product.dto";

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

    const { impressions, properties, _count, ...rest } = product;

    return {
      ...rest,
      images: rest.images ?? [],
      impressions: impressions ?? [],
      properties: properties ?? [],
      _count: {
        impressions: _count?.impressions ?? 0,
      },
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

    const productsWithData = await Promise.all(
      products.map(async (product) => {
        const { wishlistItem, cartItem } = await getWishlistAndCartItem(
          userId,
          product.id,
        );

        return {
          ...product,
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
