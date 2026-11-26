import type { CartItem, Product, WishlistItem } from "@astrum/db/client";

type CartActionRow = Pick<CartItem, "id" | "productId" | "quantity">;

type CartProductRow = Pick<
  Product,
  "id" | "name" | "price" | "previewImage" | "quantity"
>;

export const toCartLineJson = (
  cartItem: CartActionRow,
  wishlistItem: WishlistItem | null,
) => ({
  ...cartItem,
  isWishlisted: !!wishlistItem,
  quantityInCart: cartItem.quantity,
});

export const toCartProductJson = (
  product: CartProductRow,
  wishlistItem: WishlistItem | null,
  cartItem: CartItem | null,
) => ({
  ...product,
  isWishlisted: !!wishlistItem,
  quantityInCart: cartItem ? cartItem.quantity : 0,
});
