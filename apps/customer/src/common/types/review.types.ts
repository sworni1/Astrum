/** The three answers the gateway gives for the caller's write state (AC-7). */
export enum ReviewStateStatus {
  ELIGIBLE = "ELIGIBLE",
  NOT_PURCHASED = "NOT_PURCHASED",
  ALREADY_REVIEWED = "ALREADY_REVIEWED",
}

export type ReviewState = {
  status: ReviewStateStatus;
  orderItemId: string | null;
};

/** One row of the public list, exactly the fields the gateway publishes. */
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

/** The caller's own presses on this product (spec 0014, AC-3). */
export type ReviewLikedSet = {
  reviewIds: string[];
};

/** The answer of one like or unlike (spec 0014, AC-4). */
export type ReviewLikeAnswer = {
  liked: boolean;
  likeCount: number;
};

/** One row of the flat thread; a deleted row carries no text and no author. */
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

/** What a create and a delete of a comment answer (spec 0014, AC-8, AC-10). */
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

/** One row of the validation `errors` array a `400` carries. */
export type ReviewValidationError = {
  property: string;
  constraints?: Record<string, string>;
};
