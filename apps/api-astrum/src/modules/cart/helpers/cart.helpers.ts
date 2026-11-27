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
  isWishlisted: boolean,
  quantityInCart: number,
) => ({
  ...product,
  isWishlisted,
  quantityInCart,
});
