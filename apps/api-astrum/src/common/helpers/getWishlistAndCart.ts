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
