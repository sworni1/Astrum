import { productPreviewPublicSelect } from '../../common/prisma-selects/product.select';
import { AddProductToWishlistDto } from './dto/add-product.dto';
import {
  getCartItem,
  getWishlistProductIds,
} from '../../common/helpers/getWishlistAndCart';
import { prisma } from '../../../lib/prisma';
import { Product } from '../../../generated/prisma/client';

export class WishlistService {
  async getWishlist(userId: string) {
    try {
      const wishlistProductIds = await getWishlistProductIds(userId);

      const wishlist = await prisma.product.findMany({
        where: {
          id: { in: wishlistProductIds },
          isDeleted: false,
          visibility: 'Public',
          status: 'Published',
        },
        select: productPreviewPublicSelect,
      });

      const wishlistWithData = await Promise.all(
        wishlist.map(async (product) => {
          const cartItem = await getCartItem(userId, product.id);

          return {
            ...product,
            isWishlisted: true,
            quantityInCart: cartItem ? cartItem.quantity : 0,
          };
        }),
      );

      return wishlistWithData;
    } catch (error) {
      throw new Error(`getWishlist error`);
    }
  }

  async addProductToWishlist(userId: string, dto: AddProductToWishlistDto) {
    try {
      const cartItem = await getCartItem(userId, dto.productId);

      const wishlistItem = await prisma.wishlistItem.create({
        data: { userId, ...dto },
      });

      return {
        ...wishlistItem,
        isWishlisted: true,
        quantityInCart: cartItem ? cartItem.quantity : 0,
      };
    } catch (error) {
      throw new Error(`addProductToWishlist error`);
    }
  }

  async deleteProductFromWishlist(userId: string, productId: Product['id']) {
    try {
      const cartItem = await getCartItem(userId, productId);

      await prisma.wishlistItem.delete({
        where: { userId_productId: { userId, productId } },
      });

      return {
        isWishlisted: false,
        quantityInCart: cartItem ? cartItem.quantity : 0,
      };
    } catch (error) {
      throw new Error(`deleteProductFromWishlist error`);
    }
  }
}
