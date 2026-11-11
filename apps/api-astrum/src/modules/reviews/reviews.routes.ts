import { Router } from "express";
import { requireActiveAccount } from "../../middlewares/requireActiveAccount";
import { validateDto } from "../../middlewares/validateDto";
import { CreateReviewDto } from "./dto/create-review.dto";
import { ReviewsController } from "./reviews.controller";

const reviewsController = new ReviewsController();

// productReviewsRouter — mounted as /products/:productId/reviews/*
// mergeParams is the whole reason the product id arrives: a child router does
// not inherit its parent's params (spec 0012, AC-11).
export const productReviewsRouter: Router = Router({ mergeParams: true });
productReviewsRouter.get("/", reviewsController.getProductReviews);
productReviewsRouter.post(
  "/",
  requireActiveAccount,
  validateDto(CreateReviewDto),
  reviewsController.createReview,
);

// reviewsRouter — монтируется как /reviews/*
export const reviewsRouter: Router = Router();
reviewsRouter.get("/:reviewId", reviewsController.getReviewById);
