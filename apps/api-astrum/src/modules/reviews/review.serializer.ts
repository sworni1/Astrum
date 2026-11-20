export const reviewRowSelect = {
  id: true,
  rating: true,
  qualityRating: true,
  deliveryRating: true,
  accuracyRating: true,
  comment: true,
  photos: true,
  likeCount: true,
  commentCount: true,
  createdAt: true,
  User: { select: { nickName: true } },
} as const;

export type ReviewRow = {
  id: string;
  rating: number;
  qualityRating: number;
  deliveryRating: number;
  accuracyRating: number;
  comment: string;
  photos: string[];
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  User: { nickName: string | null } | null;
};

export type PublicReview = {
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
  createdAt: Date;
};

export const RATING_KEYS = ["1", "2", "3", "4", "5"] as const;

export type RatingDistribution = Record<string, number>;

export const serializeReview = (row: ReviewRow): PublicReview => {
  const authorName = row.User?.nickName?.trim();

  return {
    id: row.id,
    authorName: authorName ? authorName : null,
    rating: row.rating,
    qualityRating: row.qualityRating,
    deliveryRating: row.deliveryRating,
    accuracyRating: row.accuracyRating,
    comment: row.comment,
    photos: Array.isArray(row.photos) ? row.photos : [],
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    createdAt: row.createdAt,
  };
};

export const reviewCommentSelect = {
  id: true,
  body: true,
  createdAt: true,
  deletedAt: true,
  userId: true,
  User: { select: { nickName: true } },
} as const;

export type ReviewCommentRow = {
  id: string;
  body: string;
  createdAt: Date;
  deletedAt: Date | null;
  userId: string;
  User: { nickName: string | null } | null;
};

export type PublicReviewComment = {
  id: string;
  authorName: string | null;
  body: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  mine: boolean;
};

export const serializeReviewComment = (
  row: ReviewCommentRow,
  viewerId: string,
): PublicReviewComment => {
  const isDeleted = row.deletedAt !== null;
  const authorName = row.User?.nickName?.trim();

  return {
    id: row.id,
    authorName: isDeleted || !authorName ? null : authorName,
    body: isDeleted ? null : row.body,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
    mine: row.userId === viewerId,
  };
};

export const buildDistribution = (
  groups: { rating: number; count: number }[],
): RatingDistribution => {
  const distribution: RatingDistribution = {};

  for (const key of RATING_KEYS) {
    distribution[key] = 0;
  }

  for (const group of groups) {
    const key = String(group.rating);

    if ((RATING_KEYS as readonly string[]).includes(key)) {
      distribution[key] = group.count;
    }
  }

  return distribution;
};

export const roundAverageRating = (average: number | null): number =>
  Math.round(Number(average ?? 0) * 100) / 100;
