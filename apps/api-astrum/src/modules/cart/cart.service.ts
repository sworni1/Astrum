import { AddProductToCartDto } from './dto/add-product.dto';
import {
  cartActionsPublicSelect,
  cartPublicSelect,
} from '../../common/prisma-selects/product.select';
import { ProductService } from '../product/product.service';
import { ChangeQuantityDto } from './dto/change-quantity.dto';
import {
  getCartProductIds,
  getWishlistAndCartItem,
  getWishlistItem,
} from '../../common/helpers/getWishlistAndCart';
import { prisma } from '../../../lib/prisma';
import { Product } from '../../../generated/prisma/client';

export class CartService {
  private productService = new ProductService();

  async addProductToCart(userId: string, dto: AddProductToCartDto) {
    try {
      const wishlistItem = await getWishlistItem(userId, dto.productId);
      const { productId } = dto;

      const product = await this.productService.getProduct(userId, productId);

      if (product.quantity > 0) {
        const cartItem = await prisma.cartItem.create({
          data: { userId, productId, quantity: 1 },
          select: cartActionsPublicSelect,
        });

        if (!cartItem) {
          throw new Error('addProductToCart error');
        }

        return {
          ...cartItem,
          isWishlisted: !!wishlistItem,
          quantityInCart: 1,
        };
      } else {
        throw new Error(`Product quantity limit`);
      }
    } catch (error) {
      throw new Error(`addProductToCart error`);
    }
  }

  async changeProductCartQuantity(
    userId: string,
    productId: string,
    dto: ChangeQuantityDto,
  ) {
    try {
      const product = await this.productService.getProduct(userId, productId);

      if (dto.quantity > 0) {
        if (product.quantity >= dto.quantity) {
          const wishlistItem = await getWishlistItem(userId, productId);

          const cartItem = await prisma.cartItem.update({
            where: { userId_productId: { userId, productId: productId } },
            data: { quantity: dto.quantity },
            select: cartActionsPublicSelect,
          });

          if (!cartItem) {
            throw new Error('changeProductCartQuantity error');
          }

          return {
            ...cartItem,
            isWishlisted: !!wishlistItem,
            quantityInCart: cartItem.quantity,
          };
        } else {
          throw new Error(`Product quantity limit`);
        }
      } else {
        return this.deleteProductFromCart(userId, productId);
      }
    } catch (error) {
      throw new Error(`changeProductCartQuantity error`);
    }
  }

  async getCart(userId: string) {
    try {
      const cartProductIds = await getCartProductIds(userId);

      const cart = await prisma.product.findMany({
        where: {
          id: { in: cartProductIds },
          isDeleted: false,
          visibility: 'Public',
          status: 'Published',
        },
        select: cartPublicSelect,
      });

      const cartWithData = await Promise.all(
        cart.map(async (product) => {
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

      return cartWithData;
    } catch (error) {
      throw new Error(`getWishlist error`);
    }
  }

  async deleteProductFromCart(userId: string, productId: Product['id']) {
    try {
      const wishlistItem = getWishlistItem(userId, productId);

      await prisma.cartItem.delete({
        where: { userId_productId: { userId, productId } },
      });

      return {
        isWishlisted: !!wishlistItem,
        quantityInCart: 0,
      };
    } catch (error) {
      throw new Error(`deleteProductFromCart error`);
    }
  }
}
