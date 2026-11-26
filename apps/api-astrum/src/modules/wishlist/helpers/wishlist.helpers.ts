import type { CartItem, Product, WishlistItem } from "@astrum/db/client";

type WishlistProductRow = Pick<
  Product,
  "id" | "name" | "price" | "previewImage"
>;

type WishlistMutationRow = Pick<WishlistItem, "id" | "productId" | "createdAt">;

export const toWishlistProductJson = (
  product: WishlistProductRow,
  cartItem: CartItem | null,
) => ({
  ...product,
  isWishlisted: true,
  quantityInCart: cartItem ? cartItem.quantity : 0,
});

export const toWishlistMutationJson = (
  wishlistItem: WishlistMutationRow,
  cartItem: CartItem | null,
) => ({
  ...wishlistItem,
  isWishlisted: true,
  quantityInCart: cartItem ? cartItem.quantity : 0,
});
