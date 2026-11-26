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
import { PUBLIC_PRODUCT_WHERE } from "../product/constants/product.constants";
import { WISHLIST_ITEM_SELECT } from "./constants/wishlist.constants";
import type { AddProductToWishlistDto } from "./dto/add-product.dto";
import {
  wishlistAddFailed,
  wishlistDeleteFailed,
  wishlistReadFailed,
} from "./helpers/wishlist.errors";
import {
  toWishlistMutationJson,
  toWishlistProductJson,
} from "./helpers/wishlist.helpers";

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
          ...PUBLIC_PRODUCT_WHERE,
        },
        select: productPreviewPublicSelect,
      });

      const wishlistWithData = await Promise.all(
        wishlist.map(async (product) => {
          const cartItem = await getCartItem(owner, product.id);

          return toWishlistProductJson(product, cartItem);
        }),
      );

      return wishlistWithData;
    } catch {
      throw wishlistReadFailed();
    }
  }

  async addProductToWishlist(owner: Owner, dto: AddProductToWishlistDto) {
    try {
      const cartItem = await getCartItem(owner, dto.productId);

      const wishlistItem = await prisma.wishlistItem.upsert({
        where: ownerUniqueKey(owner, dto.productId),
        create: { ...ownerColumns(owner), productId: dto.productId },
        update: {},
        select: WISHLIST_ITEM_SELECT,
      });

      return toWishlistMutationJson(wishlistItem, cartItem);
    } catch {
      throw wishlistAddFailed();
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
      throw wishlistDeleteFailed();
    }
  }
}
