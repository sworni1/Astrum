import type { Product } from "@astrum/db/client";
import { prisma } from "../../../lib/prisma";
import {
  getCartItem,
  getWishlistProductIds,
  ownerColumns,
  ownerUniqueKey,
} from "../../common/helpers/getWishlistAndCart";
import { productPreviewPublicSelect } from "../../common/prisma-selects/product.select";
import type { Owner } from "../../common/types/owner";
import type { AddProductToWishlistDto } from "./dto/add-product.dto";

export class WishlistService {
  async getWishlist(owner: Owner | null) {
    try {
      if (!owner) {
        return [];
      }

      const wishlistProductIds = await getWishlistProductIds(owner);

      const wishlist = await prisma.product.findMany({
        where: {
          id: { in: wishlistProductIds },
          isDeleted: false,
          visibility: "Public",
          status: "Published",
        },
        select: productPreviewPublicSelect,
      });

      const wishlistWithData = await Promise.all(
        wishlist.map(async (product) => {
          const cartItem = await getCartItem(owner, product.id);

          return {
            ...product,
            isWishlisted: true,
            quantityInCart: cartItem ? cartItem.quantity : 0,
          };
        }),
      );

      return wishlistWithData;
    } catch {
      throw new Error(`getWishlist error`);
    }
  }

  /** A second press answers `200` and leaves one row instead of failing (AC-10). */
  async addProductToWishlist(owner: Owner, dto: AddProductToWishlistDto) {
    try {
      const cartItem = await getCartItem(owner, dto.productId);

      const wishlistItem = await prisma.wishlistItem.upsert({
        where: ownerUniqueKey(owner, dto.productId),
        create: { ...ownerColumns(owner), productId: dto.productId },
        update: {},
        select: { id: true, productId: true, createdAt: true },
      });

      return {
        ...wishlistItem,
        isWishlisted: true,
        quantityInCart: cartItem ? cartItem.quantity : 0,
      };
    } catch {
      throw new Error(`addProductToWishlist error`);
    }
  }

  async deleteProductFromWishlist(owner: Owner, productId: Product["id"]) {
    try {
      const cartItem = await getCartItem(owner, productId);

      await prisma.wishlistItem.delete({
        where: ownerUniqueKey(owner, productId),
      });

      return {
        isWishlisted: false,
        quantityInCart: cartItem ? cartItem.quantity : 0,
      };
    } catch {
      throw new Error(`deleteProductFromWishlist error`);
    }
  }
}
