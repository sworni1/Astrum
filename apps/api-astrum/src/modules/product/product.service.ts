import type {
  Product,
  ProductCategory,
} from "../../../generated/prisma/client";
import { ReviewStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../../lib/prisma";
import {
  getOrSet,
  invalidateLists,
  listTtlSeconds,
  productTtlSeconds,
  readVersion,
} from "../../cache/cache";
import { cacheKeys } from "../../cache/cacheKeys";
import { AppError } from "../../common/helpers/appError";
import {
  getWishlistAndCartItem,
  readPageMarks,
} from "../../common/helpers/getWishlistAndCart";
import {
  productPreviewPublicSelect,
  productPublicSelect,
} from "../../common/prisma-selects/product.select";
import { roundAverageRating } from "../reviews/review.serializer";
import { readReviewState } from "../reviews/review-state";
import type { Owner } from "../../common/types/owner";
import { PRODUCT_ERROR_CODES } from "./constants/product.constants";
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
  /**
   * The shared row comes from Redis, the caller's own marks and review state
   * stay live, so two readers share one cached product and each sees its own
   * wishlist, cart and review state (spec 0022, AC-2, AC-3). A visitor with no
   * identity owns no mark, so the shared row is all it reads (spec 0028, AC-6).
   */
  async getProduct(owner: Owner | null, productId: Product["id"]) {
    const version = await readVersion(cacheKeys.productVersion(productId));

    const product = await getOrSet({
      key: cacheKeys.product(productId, version),
      ttlSeconds: productTtlSeconds(),
      load: async () => await this.loadPublicProduct(productId),
    });

    const [{ wishlistItem, cartItem }, reviewState] = await Promise.all([
      owner
        ? getWishlistAndCartItem(owner, productId)
        : Promise.resolve({ cartItem: null, wishlistItem: null }),
      readReviewState(owner, productId),
    ]);

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
    owner: Owner | null,
    filters?: {
      category?: ProductCategory;
      search_query?: string;
    },
    cursor?: string,
    limit: number = 8,
  ) {
    const epoch = await readVersion(cacheKeys.listsEpoch());
    const key = filters?.category
      ? cacheKeys.category(
          epoch,
          filters.category,
          filters.search_query,
          cursor,
        )
      : cacheKeys.recommendations(epoch, cursor);

    const page = await getOrSet({
      key,
      ttlSeconds: listTtlSeconds(),
      epochKey: cacheKeys.listsEpoch(),
      load: async () => await this.loadCataloguePage(filters, cursor, limit),
    });

    // Two queries for the page, merged after the cached payload is read (AC-4).
    const marks = await readPageMarks(
      owner,
      page.products.map((product) => product.id),
    );

    return {
      products: page.products.map((product) => ({
        ...product,
        isWishlisted: marks.wishlisted.has(product.id),
        quantityInCart: marks.cart.get(product.id) ?? 0,
      })),
      nextCursor: page.nextCursor,
      hasNextPage: page.hasNextPage,
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

    // A new row can appear on any list, so every list key goes cold (AC-7 e).
    await invalidateLists();

    return product;
  }

  /** Only a fetched row reaches the cache: a missing product writes no key (AC-2). */
  private async loadPublicProduct(productId: Product["id"]) {
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
      throw new AppError(
        404,
        PRODUCT_ERROR_CODES.notFound,
        "Product not found",
      );
    }

    return product;
  }

  /** The shared half of a catalogue page: two queries for the whole page (AC-4). */
  private async loadCataloguePage(
    filters?: { category?: ProductCategory; search_query?: string },
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

    return {
      products: products.map((product) => {
        const rating = ratings.get(product.id);

        return {
          ...product,
          averageRating: rating?.averageRating ?? 0,
          reviewCount: rating?.reviewCount ?? 0,
        };
      }),
      nextCursor,
      hasNextPage: !!nextCursor,
    };
  }
}
