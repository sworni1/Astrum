import { Router } from 'express';
import { validateDto } from '../../middlewares/validateDto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsController } from './reviews.controller';
import authenticateToken from '../../middlewares/authenticateToken';

const reviewsController = new ReviewsController();

// productReviewsRouter — монтируется как /products/:id/reviews/*
export const productReviewsRouter = Router();
productReviewsRouter.get('/', reviewsController.getProductReviews);
productReviewsRouter.post(
  '/',
  authenticateToken,
  validateDto(CreateReviewDto),
  reviewsController.createReview,
);

// reviewsRouter — монтируется как /reviews/*
export const reviewsRouter = Router();
reviewsRouter.get('/:reviewId', reviewsController.getReviewById);
