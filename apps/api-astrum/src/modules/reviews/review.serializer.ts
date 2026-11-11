/**
 * The one shape a review takes on the wire, shared by the `201` of the write
 * route and by every row of the list, so the screen reads the same fields from
 * both (spec 0012, AC-11, AC-12).
 */
export const reviewRowSelect = {
  id: true,
  rating: true,
  qualityRating: true,
  deliveryRating: true,
  accuracyRating: true,
  comment: true,
  photos: true,
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
  createdAt: Date;
};

/** Every rating key is present, zero filled, in the answer (AC-12). */
export const RATING_KEYS = ["1", "2", "3", "4", "5"] as const;

export type RatingDistribution = Record<string, number>;

/**
 * No `userId`, no `orderItemId`, no `status` and no `updatedAt`: the screen uses
 * none of them and another customer's id is not the shop's to publish (AC-12).
 * The server never sends localized copy, so an empty nickname answers `null`.
 */
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
    createdAt: row.createdAt,
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

/** Two decimals, which is what the summary and the header print (AC-12). */
export const roundAverageRating = (average: number | null): number =>
  Math.round(Number(average ?? 0) * 100) / 100;
