import type { Product } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";

export const getWishlistAndCartItem = async (
  userId: string,
  productId: Product["id"],
) => {
  try {
    const [cartItem, wishlistItem] = await Promise.all([
      prisma.cartItem.findUnique({
        where: { userId_productId: { userId, productId } },
      }),
      prisma.wishlistItem.findUnique({
        where: { userId_productId: { userId, productId } },
      }),
    ]);

    return {
      cartItem,
      wishlistItem,
    };
  } catch (_error) {
    throw new Error("getWishlistAndCartItem error");
  }
};

export const getWishlistItem = async (
  userId: string,
  productId: Product["id"],
) => {
  try {
    return await prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
  } catch (_error) {
    throw new Error(`getWishlistItem error`);
  }
};

export const getCartItem = async (userId: string, productId: Product["id"]) => {
  try {
    return await prisma.cartItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
  } catch (_error) {
    throw new Error(`getCartItem error`);
  }
};

export type PageMarks = {
  wishlisted: Set<string>;
  cart: Map<string, number>;
};

/**
 * The marks of one page in two queries, never two per card (spec 0022, AC-4).
 * They stay out of the cache on purpose: a shared payload never carries a
 * caller's own cart or wishlist state (AC-3).
 */
export const readPageMarks = async (
  userId: string,
  productIds: readonly string[],
): Promise<PageMarks> => {
  if (productIds.length === 0) {
    return { wishlisted: new Set(), cart: new Map() };
  }

  const [wishlistItems, cartItems] = await Promise.all([
    prisma.wishlistItem.findMany({
      where: { userId, productId: { in: [...productIds] } },
      select: { productId: true },
    }),
    prisma.cartItem.findMany({
      where: { userId, productId: { in: [...productIds] } },
      select: { productId: true, quantity: true },
    }),
  ]);

  return {
    wishlisted: new Set(wishlistItems.map((item) => item.productId)),
    cart: new Map(cartItems.map((item) => [item.productId, item.quantity])),
  };
};

export const getWishlistProductIds = async (userId: string) => {
  try {
    const wishlistItems = await prisma.wishlistItem.findMany({
      where: { userId },
      select: {
        productId: true,
      },
    });

    return wishlistItems.map((item) => item.productId);
  } catch (_error) {
    throw new Error(`getWishlistProductIds error`);
  }
};

export const getCartProductIds = async (userId: string) => {
  try {
    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      select: {
        productId: true,
      },
    });

    return cartItems.map((item) => item.productId);
  } catch (_error) {
    throw new Error(`getCartProductIds error`);
  }
};
