import { Router } from "express";
import { validateDto } from "../../middlewares/validateDto";
import { CartController } from "./cart.controller";
import { AddProductToCartDto } from "./dto/add-product.dto";
import { ChangeQuantityDto } from "./dto/change-quantity.dto";

const cartController = new CartController();

const cartRoutes: Router = Router();

cartRoutes.get("/", cartController.getCart);
cartRoutes.delete("/:productId", cartController.deleteProductFromCart);
cartRoutes.patch(
  "/:productId",
  validateDto(ChangeQuantityDto),
  cartController.changeProductCartQuantity,
);
cartRoutes.post(
  "/",
  validateDto(AddProductToCartDto),
  cartController.addProductToCart,
);

export default cartRoutes;
