import type { Product } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import type { Owner } from "../types/owner";

/** The owner columns of one row: an account id or a guest id, never both (spec 0028, AC-1). */
export const ownerColumns = (
  owner: Owner,
): { userId: string } | { guestId: string } =>
  owner.kind === "user" ? { userId: owner.userId } : { guestId: owner.guestId };

/** The named unique key the owner columns select, so an upsert and a read agree. */
export const ownerUniqueKey = (
  owner: Owner,
  productId: Product["id"],
):
  | { userId_productId: { userId: string; productId: string } }
  | { guestId_productId: { guestId: string; productId: string } } =>
  owner.kind === "user"
    ? { userId_productId: { userId: owner.userId, productId } }
    : { guestId_productId: { guestId: owner.guestId, productId } };

export const getWishlistAndCartItem = async (
  owner: Owner,
  productId: Product["id"],
) => {
  try {
    const [cartItem, wishlistItem] = await Promise.all([
      prisma.cartItem.findUnique({ where: ownerUniqueKey(owner, productId) }),
      prisma.wishlistItem.findUnique({
        where: ownerUniqueKey(owner, productId),
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
  owner: Owner,
  productId: Product["id"],
) => {
  try {
    return await prisma.wishlistItem.findUnique({
      where: ownerUniqueKey(owner, productId),
    });
  } catch (_error) {
    throw new Error(`getWishlistItem error`);
  }
};

export const getCartItem = async (owner: Owner, productId: Product["id"]) => {
  try {
    return await prisma.cartItem.findUnique({
      where: ownerUniqueKey(owner, productId),
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
 * caller's own cart or wishlist state (AC-3). A reader with no identity owns no
 * row, so the answer is empty without a query (spec 0028, AC-6).
 */
export const readPageMarks = async (
  owner: Owner | null,
  productIds: readonly string[],
): Promise<PageMarks> => {
  if (!owner || productIds.length === 0) {
    return { wishlisted: new Set(), cart: new Map() };
  }

  const [wishlistItems, cartItems] = await Promise.all([
    prisma.wishlistItem.findMany({
      where: { ...ownerColumns(owner), productId: { in: [...productIds] } },
      select: { productId: true },
    }),
    prisma.cartItem.findMany({
      where: { ...ownerColumns(owner), productId: { in: [...productIds] } },
      select: { productId: true, quantity: true },
    }),
  ]);

  return {
    wishlisted: new Set(wishlistItems.map((item) => item.productId)),
    cart: new Map(cartItems.map((item) => [item.productId, item.quantity])),
  };
};

export const getWishlistProductIds = async (owner: Owner) => {
  try {
    const wishlistItems = await prisma.wishlistItem.findMany({
      where: ownerColumns(owner),
      select: {
        productId: true,
      },
    });

    return wishlistItems.map((item) => item.productId);
  } catch (_error) {
    throw new Error(`getWishlistProductIds error`);
  }
};

export const getCartProductIds = async (owner: Owner) => {
  try {
    const cartItems = await prisma.cartItem.findMany({
      where: ownerColumns(owner),
      select: {
        productId: true,
      },
    });

    return cartItems.map((item) => item.productId);
  } catch (_error) {
    throw new Error(`getCartProductIds error`);
  }
};
