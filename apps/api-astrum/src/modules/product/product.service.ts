import { CreateProductDto } from './dto/create-product.dto';
import { randomUUID } from 'crypto';
import {
  productPreviewPublicSelect,
  productPublicSelect,
} from '../../common/prisma-selects/product.select';
import { getWishlistAndCartItem } from '../../common/helpers/getWishlistAndCart';
import { prisma } from '../../../lib/prisma';
import { Product, ProductCategory } from '../../../generated/prisma/client';

export class ProductService {
  async getProduct(userId: string, productId: Product['id']) {
    const { wishlistItem, cartItem } = await getWishlistAndCartItem(
      userId,
      productId,
    );

    const product = await prisma.product.findUnique({
      where: {
        id: productId,
        isDeleted: false,
        visibility: 'Public',
        status: 'Published',
      },
      select: productPublicSelect,
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const { impressions, properties, _count, ...rest } = product as any;

    return {
      ...rest,
      images: rest.images ?? [],
      impressions: impressions ?? [],
      properties: properties ?? [],
      _count: {
        impressions: _count?.impressions ?? 0,
      },
      isWishlisted: !!wishlistItem,
      quantityInCart: cartItem ? cartItem.quantity : 0,
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
        visibility: 'Public',
        status: 'Published',
        ...(filters?.category ? { category: filters.category } : {}),
        ...(filters?.search_query
          ? {
              name: { contains: filters.search_query, mode: 'insensitive' },
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

  async createProduct(dto: CreateProductDto) {
    const product = await prisma.product.create({
      data: { businessId: randomUUID(), ...dto },
    });

    return product;
  }
}
