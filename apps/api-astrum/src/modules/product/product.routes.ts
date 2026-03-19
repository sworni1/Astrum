import { Router } from "express";
import { ProductController } from "./product.controller";

const productController = new ProductController();

const productRoutes = Router();

productRoutes.get("/recommendations", productController.getRecommendations);
productRoutes.get(
  "/categories/:category",
  productController.getCategoryProducts
);
productRoutes.post("/", productController.createProduct);
productRoutes.get("/:productId", productController.getProduct);

export default productRoutes;
