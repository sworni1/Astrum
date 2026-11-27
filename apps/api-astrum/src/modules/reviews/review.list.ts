import { ReviewStatus } from "@astrum/db/enums";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import {
  REVIEW_ERROR_CODES,
  REVIEW_LIST_ORDER_BY,
} from "./constants/reviews.constants";
import {
  buildDistribution,
  type ReviewRow,
  reviewRowSelect,
  roundAverageRating,
  serializeReview,
} from "./review.serializer";

export const loadReviewPage = async (
  productId: string,
  limit: number,
  after: string | undefined,
) => {
  if (after !== undefined) {
    const cursorRow = await prisma.review.findFirst({
      where: { id: after, productId, status: ReviewStatus.APPROVED },
      select: { id: true },
    });

    if (!cursorRow) {
      throw new AppError(
        400,
        REVIEW_ERROR_CODES.invalidCursor,
        "after must be a review of this product",
      );
    }
  }

  const where = { productId, status: ReviewStatus.APPROVED };

  const [rows, total, average, ratingGroups] = await Promise.all([
    prisma.review.findMany({
      where,
      take: limit + 1,
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),

      orderBy: REVIEW_LIST_ORDER_BY,
      select: reviewRowSelect,
    }),
    prisma.review.count({ where }),
    prisma.review.aggregate({ where, _avg: { rating: true } }),
    prisma.review.groupBy({
      by: ["rating"],
      where,
      _count: { _all: true },
    }),
  ]);

  const hasNextPage = rows.length > limit;
  const page = hasNextPage ? rows.slice(0, limit) : rows;
  const nextCursor = hasNextPage ? page[page.length - 1].id : null;

  return {
    reviews: page.map((row) => serializeReview(row as ReviewRow)),
    nextCursor,
    hasNextPage,
    aggregate: {
      total,
      averageRating: roundAverageRating(average._avg.rating as number | null),
      distribution: buildDistribution(
        ratingGroups.map((group) => ({
          rating: group.rating,
          count: group._count._all,
        })),
      ),
    },
  };
};
