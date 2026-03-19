import { Router } from "express";
import { WishlistController } from "./wishlist.controller";
import { validateDto } from "../../middlewares/validateDto";
import { AddProductToWishlistDto } from "./dto/add-product.dto";

const wishlistController = new WishlistController();

const wishlistRoutes = Router();

wishlistRoutes.get("/", wishlistController.getWishlist);
wishlistRoutes.delete(
  "/:productId",
  wishlistController.deleteProductFromWishlist
);
wishlistRoutes.post(
  "/",
  validateDto(AddProductToWishlistDto),
  wishlistController.addProductToWishlist
);

export default wishlistRoutes;
