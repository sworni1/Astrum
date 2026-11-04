import { Router } from "express";
import { validateDto } from "../../middlewares/validateDto";
import { CreateReviewDto } from "./dto/create-review.dto";
import { ReviewsController } from "./reviews.controller";

const reviewsController = new ReviewsController();

// productReviewsRouter — монтируется как /products/:id/reviews/*
export const productReviewsRouter: Router = Router();
productReviewsRouter.get("/", reviewsController.getProductReviews);
productReviewsRouter.post(
  "/",
  validateDto(CreateReviewDto),
  reviewsController.createReview,
);

// reviewsRouter — монтируется как /reviews/*
export const reviewsRouter: Router = Router();
reviewsRouter.get("/:reviewId", reviewsController.getReviewById);
