import { Router } from "express";
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
  validateDto(CreateProductDto),
  productController.createProduct,
);
productRoutes.get("/:productId", productController.getProduct);

// Nested review routes for a specific product
productRoutes.use("/:productId/reviews", productReviewsRouter);

// The caller's own liked set for this product (spec 0014, AC-3)
productRoutes.use("/:productId/review-likes", productReviewLikesRouter);

export default productRoutes;
