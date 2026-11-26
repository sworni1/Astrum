export const quantityLimit = (): Error => new Error("Product quantity limit");

export const changeQuantityFailed = (): Error =>
  new Error("changeProductCartQuantity error");

export const cartReadFailed = (): Error => new Error("getWishlist error");

export const cartDeleteFailed = (): Error =>
  new Error("deleteProductFromCart error");
