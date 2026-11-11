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
}
