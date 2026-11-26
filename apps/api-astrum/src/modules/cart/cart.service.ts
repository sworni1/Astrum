import type { Product } from "@astrum/db/client";
import { prisma } from "../../../lib/prisma";
import {
  getCartProductIds,
  getWishlistAndCartItem,
  getWishlistItem,
  ownerColumns,
  ownerUniqueKey,
} from "../../common/helpers/getWishlistAndCart";
import {
  cartActionsPublicSelect,
  cartPublicSelect,
} from "../../common/prisma-selects/product.select";
import type { Owner } from "../../common/types/owner";
import { PUBLIC_PRODUCT_WHERE } from "../product/constants/product.constants";
import { ProductService } from "../product/product.service";
import type { AddProductToCartDto } from "./dto/add-product.dto";
import type { ChangeQuantityDto } from "./dto/change-quantity.dto";
import {
  cartDeleteFailed,
  cartReadFailed,
  changeQuantityFailed,
  quantityLimit,
} from "./helpers/cart.errors";
import { toCartLineJson, toCartProductJson } from "./helpers/cart.helpers";

export class CartService {
  private productService = new ProductService();

  async addProductToCart(owner: Owner, dto: AddProductToCartDto) {
    const { productId } = dto;

    const product = await this.productService.getProduct(owner, productId);

    if (product.quantity <= 0) {
      throw quantityLimit();
    }

    const wishlistItem = await getWishlistItem(owner, productId);

    const cartItem = await prisma.$transaction(async (tx) => {
      const existing = await tx.cartItem.findUnique({
        where: ownerUniqueKey(owner, productId),
      });

      const quantity = Math.min(
        (existing?.quantity ?? 0) + 1,
        product.quantity,
      );

      return await tx.cartItem.upsert({
        where: ownerUniqueKey(owner, productId),
        create: { ...ownerColumns(owner), productId, quantity },
        update: { quantity },
        select: cartActionsPublicSelect,
      });
    });

    return toCartLineJson(cartItem, wishlistItem);
  }

  async changeProductCartQuantity(
    owner: Owner,
    productId: string,
    dto: ChangeQuantityDto,
  ) {
    try {
      const product = await this.productService.getProduct(owner, productId);

      if (dto.quantity > 0) {
        if (product.quantity >= dto.quantity) {
          const wishlistItem = await getWishlistItem(owner, productId);

          const cartItem = await prisma.cartItem.update({
            where: ownerUniqueKey(owner, productId),
            data: { quantity: dto.quantity },
            select: cartActionsPublicSelect,
          });

          return toCartLineJson(cartItem, wishlistItem);
        } else {
          throw quantityLimit();
        }
      } else {
        return this.deleteProductFromCart(owner, productId);
      }
    } catch (_error) {
      throw changeQuantityFailed();
    }
  }

  async getCart(owner: Owner | null) {
    try {
      if (!owner) {
        return [];
      }

      const cartProductIds = await getCartProductIds(owner);

      const cart = await prisma.product.findMany({
        where: {
          id: { in: cartProductIds },
          ...PUBLIC_PRODUCT_WHERE,
        },
        select: cartPublicSelect,
      });

      const cartWithData = await Promise.all(
        cart.map(async (product) => {
          const { wishlistItem, cartItem } = await getWishlistAndCartItem(
            owner,
            product.id,
          );

          return toCartProductJson(product, wishlistItem, cartItem);
        }),
      );

      return cartWithData;
    } catch (_error) {
      throw cartReadFailed();
    }
  }

  async deleteProductFromCart(owner: Owner, productId: Product["id"]) {
    try {
      const wishlistItem = await getWishlistItem(owner, productId);

      await prisma.cartItem.delete({
        where: ownerUniqueKey(owner, productId),
      });

      return {
        isWishlisted: !!wishlistItem,
        quantityInCart: 0,
      };
    } catch (_error) {
      throw cartDeleteFailed();
    }
  }
}
