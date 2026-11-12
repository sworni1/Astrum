import { Router } from "express";
import { requireActiveAccount } from "../../middlewares/requireActiveAccount";
import { validateDto } from "../../middlewares/validateDto";
import { CreateReviewCommentDto } from "./dto/create-review-comment.dto";
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

// productReviewLikesRouter — mounted as /products/:productId/review-likes/*
// The caller's own liked set lives here and not on a review row, so the list
// body stays identical for every reader (spec 0014, AC-3).
export const productReviewLikesRouter: Router = Router({ mergeParams: true });
productReviewLikesRouter.get("/", reviewsController.getProductReviewLikes);

// reviewsRouter — mounted as /reviews/*
export const reviewsRouter: Router = Router();
reviewsRouter.get("/:reviewId", reviewsController.getReviewById);

// A like needs a confirmed account; the unlike acts on existence alone, so a
// like given before a status change can still be withdrawn (spec 0014, AC-4).
reviewsRouter.put(
  "/:reviewId/like",
  requireActiveAccount,
  reviewsController.likeReview,
);
reviewsRouter.delete(
  "/:reviewId/like",
  requireActiveAccount,
  reviewsController.unlikeReview,
);

// The thread is readable by any signed in customer and written only by an
// active account (spec 0014, AC-7, AC-9).
reviewsRouter.get("/:reviewId/comments", reviewsController.getReviewComments);
reviewsRouter.post(
  "/:reviewId/comments",
  requireActiveAccount,
  validateDto(CreateReviewCommentDto),
  reviewsController.createReviewComment,
);
reviewsRouter.delete(
  "/:reviewId/comments/:commentId",
  requireActiveAccount,
  reviewsController.deleteReviewComment,
);
