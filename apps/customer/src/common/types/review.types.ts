export enum ReviewStateStatus {
  ELIGIBLE = "ELIGIBLE",
  NOT_PURCHASED = "NOT_PURCHASED",
  ALREADY_REVIEWED = "ALREADY_REVIEWED",
}

export type ReviewState = {
  status: ReviewStateStatus;
  orderItemId: string | null;
};

export type ProductReview = {
  id: string;
  authorName: string | null;
  rating: number;
  qualityRating: number;
  deliveryRating: number;
  accuracyRating: number;
  comment: string;
  photos: string[];
  likeCount: number;
  commentCount: number;
  createdAt: string;
};

export type ReviewAggregate = {
  total: number;
  averageRating: number;
  distribution: Record<string, number>;
};

export type ReviewPage = {
  reviews: ProductReview[];
  nextCursor: string | null;
  hasNextPage: boolean;
  aggregate: ReviewAggregate;
};

export type ReviewLikedSet = {
  reviewIds: string[];
};

export type ReviewLikeAnswer = {
  liked: boolean;
  likeCount: number;
};

export type ReviewComment = {
  id: string;
  authorName: string | null;
  body: string | null;
  createdAt: string;
  deletedAt: string | null;
  mine: boolean;
};

export type ReviewCommentPage = {
  comments: ReviewComment[];
  nextCursor: string | null;
  hasNextPage: boolean;
};

export type ReviewCommentWriteAnswer = {
  comment: ReviewComment;
  commentCount: number;
};

export type CreateReviewDto = {
  orderItemId: string;
  rating: number;
  qualityRating: number;
  deliveryRating: number;
  accuracyRating: number;
  comment: string;
};

export type CreateReviewCommentDto = {
  body: string;
};

export type ReviewCreateError = {
  message: string;
  status?: number;
};

export type ReviewValidationError = {
  property: string;
  constraints?: Record<string, string>;
};
