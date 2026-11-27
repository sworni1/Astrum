import { Router } from "express";
import { requireActiveAccount } from "../../middlewares/requireActiveAccount";
import { requireSession } from "../../middlewares/resolveOwner";
import { validateDto } from "../../middlewares/validateDto";
import { CreateReviewDto } from "./dto/create-review.dto";
import { CreateReviewCommentDto } from "./dto/create-review-comment.dto";
import { ReviewsController } from "./reviews.controller";

const reviewsController = new ReviewsController();

export const productReviewsRouter: Router = Router({ mergeParams: true });
productReviewsRouter.get("/", reviewsController.getProductReviews);
productReviewsRouter.post(
  "/",
  requireSession,
  requireActiveAccount,
  validateDto(CreateReviewDto),
  reviewsController.createReview,
);

export const productReviewLikesRouter: Router = Router({ mergeParams: true });
productReviewLikesRouter.get("/", reviewsController.getProductReviewLikes);

export const reviewsRouter: Router = Router();
reviewsRouter.get("/:reviewId", reviewsController.getReviewById);

reviewsRouter.put(
  "/:reviewId/like",
  requireSession,
  requireActiveAccount,
  reviewsController.likeReview,
);
reviewsRouter.delete(
  "/:reviewId/like",
  requireSession,
  requireActiveAccount,
  reviewsController.unlikeReview,
);

reviewsRouter.get("/:reviewId/comments", reviewsController.getReviewComments);
reviewsRouter.post(
  "/:reviewId/comments",
  requireSession,
  requireActiveAccount,
  validateDto(CreateReviewCommentDto),
  reviewsController.createReviewComment,
);
reviewsRouter.delete(
  "/:reviewId/comments/:commentId",
  requireSession,
  requireActiveAccount,
  reviewsController.deleteReviewComment,
);
