import { Router } from "express";
import { validateDto } from "../../middlewares/validateDto";
import { AddProductToWishlistDto } from "./dto/add-product.dto";
import { WishlistController } from "./wishlist.controller";

const wishlistController = new WishlistController();

const wishlistRoutes: Router = Router();

wishlistRoutes.get("/", wishlistController.getWishlist);
wishlistRoutes.delete(
  "/:productId",
  wishlistController.deleteProductFromWishlist,
);
wishlistRoutes.post(
  "/",
  validateDto(AddProductToWishlistDto),
  wishlistController.addProductToWishlist,
);

export default wishlistRoutes;
