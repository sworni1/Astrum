import type { Product } from "@astrum/db/client";
import { prisma } from "../../../lib/prisma";
import {
  getCartItem,
  ownerColumns,
  ownerUniqueKey,
} from "../../common/helpers/getWishlistAndCart";
import { productPreviewPublicSelect } from "../../common/prisma-selects/product.select";
import type { Owner } from "../../common/types/owner";
import { productNotFound } from "../product/helpers/product.errors";
import { PUBLIC_PRODUCT_WHERE } from "../product/constants/product.constants";
import { WISHLIST_ITEM_SELECT } from "./constants/wishlist.constants";
import type { AddProductToWishlistDto } from "./dto/add-product.dto";
import {
  toWishlistMutationJson,
  toWishlistProductJson,
} from "./helpers/wishlist.helpers";

export class WishlistService {
  async getWishlist(owner: Owner | null) {
    if (!owner) {
      return [];
    }

    const wishlistRows = await prisma.wishlistItem.findMany({
      where: ownerColumns(owner),
      select: { productId: true },
    });

    if (wishlistRows.length === 0) {
      return [];
    }

    const productIds = wishlistRows.map((row) => row.productId);

    const [products, cartRows] = await Promise.all([
      prisma.product.findMany({
        where: {
          id: { in: productIds },
          ...PUBLIC_PRODUCT_WHERE,
        },
        select: productPreviewPublicSelect,
      }),
      prisma.cartItem.findMany({
        where: { ...ownerColumns(owner), productId: { in: productIds } },
        select: { productId: true, quantity: true },
      }),
    ]);

    const quantities = new Map(
      cartRows.map((row) => [row.productId, row.quantity]),
    );

    return products.map((product) =>
      toWishlistProductJson(product, quantities.get(product.id) ?? 0),
    );
  }

  async addProductToWishlist(owner: Owner, dto: AddProductToWishlistDto) {
    const product = await prisma.product.findFirst({
      where: { id: dto.productId, ...PUBLIC_PRODUCT_WHERE },
      select: { id: true },
    });

    if (!product) {
      throw productNotFound();
    }

    const cartItem = await getCartItem(owner, dto.productId);

    const wishlistItem = await prisma.wishlistItem.upsert({
      where: ownerUniqueKey(owner, dto.productId),
      create: { ...ownerColumns(owner), productId: dto.productId },
      update: {},
      select: WISHLIST_ITEM_SELECT,
    });

    return toWishlistMutationJson(wishlistItem, cartItem);
  }

  async deleteProductFromWishlist(owner: Owner, productId: Product["id"]) {
    const cartItem = await getCartItem(owner, productId);

    await prisma.wishlistItem.deleteMany({
      where: { ...ownerColumns(owner), productId },
    });

    return {
      isWishlisted: false,
      quantityInCart: cartItem ? cartItem.quantity : 0,
    };
  }
}
