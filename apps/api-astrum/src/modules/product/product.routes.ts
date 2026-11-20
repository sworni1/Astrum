import { Router } from "express";
import { requireSession } from "../../middlewares/resolveOwner";
import { validateDto } from "../../middlewares/validateDto";
import {
  productReviewLikesRouter,
  productReviewsRouter,
} from "../reviews/reviews.routes";
import { CreateProductDto } from "./dto/create-product.dto";
import { ProductController } from "./product.controller";

const productController = new ProductController();

const productRoutes: Router = Router();

productRoutes.get("/recommendations", productController.getRecommendations);
productRoutes.get(
  "/categories/:category",
  productController.getCategoryProducts,
);
productRoutes.post(
  "/",
  requireSession,
  validateDto(CreateProductDto),
  productController.createProduct,
);
productRoutes.get("/:productId", productController.getProduct);

productRoutes.use("/:productId/reviews", productReviewsRouter);

productRoutes.use("/:productId/review-likes", productReviewLikesRouter);

export default productRoutes;
