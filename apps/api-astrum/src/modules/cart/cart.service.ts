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
import { ProductService } from "../product/product.service";
import type { AddProductToCartDto } from "./dto/add-product.dto";
import type { ChangeQuantityDto } from "./dto/change-quantity.dto";

export class CartService {
  private productService = new ProductService();

  /**
   * One line per owner and product: a repeated add raises the quantity capped at
   * the stock instead of failing on the unique key (spec 0028, AC-10).
   */
  async addProductToCart(owner: Owner, dto: AddProductToCartDto) {
    const { productId } = dto;

    const product = await this.productService.getProduct(owner, productId);

    if (product.quantity <= 0) {
      throw new Error("Product quantity limit");
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

    return {
      ...cartItem,
      isWishlisted: !!wishlistItem,
      quantityInCart: cartItem.quantity,
    };
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

          return {
            ...cartItem,
            isWishlisted: !!wishlistItem,
            quantityInCart: cartItem.quantity,
          };
        } else {
          throw new Error(`Product quantity limit`);
        }
      } else {
        return this.deleteProductFromCart(owner, productId);
      }
    } catch (_error) {
      throw new Error(`changeProductCartQuantity error`);
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
          isDeleted: false,
          visibility: "Public",
          status: "Published",
        },
        select: cartPublicSelect,
      });

      const cartWithData = await Promise.all(
        cart.map(async (product) => {
          const { wishlistItem, cartItem } = await getWishlistAndCartItem(
            owner,
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
    } catch (_error) {
      throw new Error(`getWishlist error`);
    }
  }

  async deleteProductFromCart(owner: Owner, productId: Product["id"]) {
    try {
      // Awaited on purpose: without it every delete answered `true` (AC-8).
      const wishlistItem = await getWishlistItem(owner, productId);

      await prisma.cartItem.delete({
        where: ownerUniqueKey(owner, productId),
      });

      return {
        isWishlisted: !!wishlistItem,
        quantityInCart: 0,
      };
    } catch (_error) {
      throw new Error(`deleteProductFromCart error`);
    }
  }
}
