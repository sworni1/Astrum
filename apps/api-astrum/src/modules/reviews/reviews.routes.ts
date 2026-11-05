import { Router } from "express";
import { requireActiveAccount } from "../../middlewares/requireActiveAccount";
import { validateDto } from "../../middlewares/validateDto";
import { CreateReviewDto } from "./dto/create-review.dto";
import { ReviewsController } from "./reviews.controller";

const reviewsController = new ReviewsController();

// productReviewsRouter — монтируется как /products/:id/reviews/*
export const productReviewsRouter: Router = Router();
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
