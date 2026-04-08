import { Request, Response } from 'express';
import { ReviewsService } from './reviews.service';
import { StatusCodes } from 'http-status-codes';
import { handleErrors } from '../../common/helpers/errorHandler';
import { predictSentiment } from '../../lib/sentimentClient';

const reviewsService = new ReviewsService();

export class ReviewsController {
  async createReview(req: Request, res: Response) {
    try {
      const productId = req.params['id'] as string;
      const userId = (req as any).userId;
      const dto = req.body;

      const review = await reviewsService.createReview(userId, productId, dto);

      const sentiment = await predictSentiment(String(review.comment ?? ''))

      res.status(StatusCodes.CREATED).json({ ...review, sentiment });
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async getProductReviews(req: Request, res: Response) {
    try {
      const productId = req.params['id'] as string;
      const { after, limit } = req.query;

      const result = await reviewsService.getReviewsForProduct(productId, {
        after: after as string,
        limit: limit ? Number(limit) : undefined,
      });

      res.status(StatusCodes.OK).json(result);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async getReviewById(req: Request, res: Response) {
    try {
      const reviewId = req.params['reviewId'] as string;

      const review = await reviewsService.getReviewById(reviewId);

      res.status(StatusCodes.OK).json(review);
    } catch (err) {
      handleErrors(res, err);
    }
  }
}