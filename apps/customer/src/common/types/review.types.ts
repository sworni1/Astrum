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

export type CreateReviewDto = {
  orderItemId: string;
  rating: number;
  qualityRating: number;
  deliveryRating: number;
  accuracyRating: number;
  comment: string;
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
