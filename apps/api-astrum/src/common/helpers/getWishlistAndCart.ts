import type { Product } from "@astrum/db/client";
import { prisma } from "../../../lib/prisma";
import type { Owner } from "../types/owner";

export const ownerColumns = (
  owner: Owner,
): { userId: string } | { guestId: string } =>
  owner.kind === "user" ? { userId: owner.userId } : { guestId: owner.guestId };

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
  const [cartItem, wishlistItem] = await Promise.all([
    prisma.cartItem.findUnique({ where: ownerUniqueKey(owner, productId) }),
    prisma.wishlistItem.findUnique({ where: ownerUniqueKey(owner, productId) }),
  ]);

  return {
    cartItem,
    wishlistItem,
  };
};

export const getWishlistItem = async (
  owner: Owner,
  productId: Product["id"],
) =>
  await prisma.wishlistItem.findUnique({
    where: ownerUniqueKey(owner, productId),
  });

export const getCartItem = async (owner: Owner, productId: Product["id"]) =>
  await prisma.cartItem.findUnique({
    where: ownerUniqueKey(owner, productId),
  });

export type PageMarks = {
  wishlisted: Set<string>;
  cart: Map<string, number>;
};

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
