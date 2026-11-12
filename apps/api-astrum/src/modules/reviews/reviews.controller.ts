import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { handleErrors } from "../../common/helpers/errorHandler";
import type { AuthenticatedUserRequest } from "../../common/types/jwt.payload";
import { ReviewsService } from "./reviews.service";

const reviewsService = new ReviewsService();

export class ReviewsController {
  async createReview(req: Request, res: Response) {
    try {
      // The child router carries the parent's params (mergeParams), so the
      // product always comes from the path and never from the body.
      const productId = req.params.productId as string;
      const { userId } = req as AuthenticatedUserRequest;
      const dto = req.body;

      const review = await reviewsService.createReview(userId, productId, dto);

      res.status(StatusCodes.CREATED).json(review);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async getProductReviews(req: Request, res: Response) {
    try {
      const productId = req.params.productId as string;
      const { after, limit } = req.query;

      const result = await reviewsService.getReviewsForProduct(productId, {
        after,
        limit,
      });

      res.status(StatusCodes.OK).json(result);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async getReviewById(req: Request, res: Response) {
    try {
      const reviewId = req.params.reviewId as string;

      const review = await reviewsService.getReviewById(reviewId);

      res.status(StatusCodes.OK).json(review);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async getProductReviewLikes(req: Request, res: Response) {
    try {
      const productId = req.params.productId as string;
      const { userId } = req as AuthenticatedUserRequest;

      const result = await reviewsService.getLikedReviewIds(userId, productId);

      res.status(StatusCodes.OK).json(result);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async likeReview(req: Request, res: Response) {
    try {
      const reviewId = req.params.reviewId as string;
      const { userId } = req as AuthenticatedUserRequest;

      const result = await reviewsService.likeReview(userId, reviewId);

      res.status(StatusCodes.OK).json(result);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async unlikeReview(req: Request, res: Response) {
    try {
      const reviewId = req.params.reviewId as string;
      const { userId } = req as AuthenticatedUserRequest;

      const result = await reviewsService.unlikeReview(userId, reviewId);

      res.status(StatusCodes.OK).json(result);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async getReviewComments(req: Request, res: Response) {
    try {
      const reviewId = req.params.reviewId as string;
      const { userId } = req as AuthenticatedUserRequest;
      const { after, limit } = req.query;

      const result = await reviewsService.getReviewComments(reviewId, userId, {
        after,
        limit,
      });

      res.status(StatusCodes.OK).json(result);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async createReviewComment(req: Request, res: Response) {
    try {
      const reviewId = req.params.reviewId as string;
      const { userId } = req as AuthenticatedUserRequest;
      const dto = req.body;

      const result = await reviewsService.createReviewComment(
        userId,
        reviewId,
        dto,
      );

      res.status(StatusCodes.CREATED).json(result);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async deleteReviewComment(req: Request, res: Response) {
    try {
      const reviewId = req.params.reviewId as string;
      const commentId = req.params.commentId as string;
      const { userId } = req as AuthenticatedUserRequest;

      const result = await reviewsService.deleteReviewComment(
        userId,
        reviewId,
        commentId,
      );

      res.status(StatusCodes.OK).json(result);
    } catch (err) {
      handleErrors(res, err);
    }
  }
}
