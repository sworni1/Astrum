export const wishlistReadFailed = (): Error => new Error("getWishlist error");

export const wishlistAddFailed = (): Error =>
  new Error("addProductToWishlist error");

export const wishlistDeleteFailed = (): Error =>
  new Error("deleteProductFromWishlist error");
