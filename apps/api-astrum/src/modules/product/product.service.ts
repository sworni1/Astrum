import type { Product, ProductCategory } from "@astrum/db/client";
import { prisma } from "../../../lib/prisma";
import {
  getOrSet,
  invalidateLists,
  listTtlSeconds,
  productTtlSeconds,
  readVersion,
} from "../../cache/cache";
import { cacheKeys } from "../../cache/cacheKeys";
import {
  getWishlistAndCartItem,
  readPageMarks,
} from "../../common/helpers/getWishlistAndCart";
import {
  productPreviewPublicSelect,
  productPublicSelect,
} from "../../common/prisma-selects/product.select";
import type { Owner } from "../../common/types/owner";
import { readReviewState } from "../reviews/review-state";
import {
  PRODUCT_DEFAULT_PAGE_SIZE,
  PRODUCT_LIST_ORDER_BY,
  PUBLIC_PRODUCT_WHERE,
} from "./constants/product.constants";
import type { CreateProductDto } from "./dto/create-product.dto";
import {
  invalidCursor,
  productNotFound,
  sellerNotAssigned,
} from "./helpers/product.errors";
import { readPageRatings } from "./helpers/product-rating.helpers";

export class ProductService {
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
    cursor?: string,
    limit: number = PRODUCT_DEFAULT_PAGE_SIZE,
  ) {
    const epoch = await readVersion(cacheKeys.listsEpoch());

    const page = await getOrSet({
      key: cacheKeys.recommendations(epoch, cursor),
      ttlSeconds: listTtlSeconds(),
      epochKey: cacheKeys.listsEpoch(),
      load: async () => await this.loadCataloguePage({}, cursor, limit),
    });

    return await this.withMarks(owner, page);
  }

  async getCategoryProducts(
    owner: Owner | null,
    filters: {
      category?: ProductCategory;
      search_query?: string;
    },
    cursor?: string,
    limit: number = PRODUCT_DEFAULT_PAGE_SIZE,
  ) {
    const epoch = await readVersion(cacheKeys.listsEpoch());

    const page = await getOrSet({
      key: cacheKeys.catalogue(
        epoch,
        filters.category ?? "all",
        filters.search_query,
        cursor,
      ),
      ttlSeconds: listTtlSeconds(),
      epochKey: cacheKeys.listsEpoch(),
      load: async () => await this.loadCataloguePage(filters, cursor, limit),
    });

    return await this.withMarks(owner, page);
  }

  private async withMarks<T extends { id: string }>(
    owner: Owner | null,
    page: {
      products: T[];
      nextCursor: string | null;
      hasNextPage: boolean;
    },
  ) {
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

  async createProduct(userId: string, dto: CreateProductDto) {
    const business = await prisma.business.findUnique({
      where: { ownerUserId: userId },
      select: { id: true },
    });

    if (!business) {
      throw sellerNotAssigned();
    }

    const product = await prisma.product.create({
      data: { ...dto, businessId: business.id },
    });

    await invalidateLists();

    return product;
  }

  private async loadPublicProduct(productId: Product["id"]) {
    const product = await prisma.product.findUnique({
      where: {
        id: productId,
        ...PUBLIC_PRODUCT_WHERE,
      },
      select: productPublicSelect,
    });

    if (!product) {
      throw productNotFound();
    }

    return product;
  }

  private async loadCataloguePage(
    filters: { category?: ProductCategory; search_query?: string },
    cursor?: string,
    limit: number = PRODUCT_DEFAULT_PAGE_SIZE,
  ) {
    if (cursor !== undefined) {
      const anchor = await prisma.product.findFirst({
        where: { id: cursor, ...PUBLIC_PRODUCT_WHERE },
        select: { id: true },
      });

      if (anchor === null) {
        throw invalidCursor();
      }
    }

    const rows = await prisma.product.findMany({
      where: {
        ...PUBLIC_PRODUCT_WHERE,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.search_query
          ? {
              name: { contains: filters.search_query, mode: "insensitive" },
            }
          : {}),
      },
      select: productPreviewPublicSelect,
      orderBy: PRODUCT_LIST_ORDER_BY,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor
        ? {
            id: cursor,
          }
        : undefined,
    });

    const hasNextPage = rows.length > limit;
    const products = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage
      ? (products[products.length - 1]?.id ?? null)
      : null;

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
      hasNextPage,
    };
  }
}
