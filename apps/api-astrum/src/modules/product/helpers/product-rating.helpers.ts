import type { Product } from "@astrum/db/client";
import { ReviewStatus } from "@astrum/db/enums";
import { prisma } from "../../../../lib/prisma";
import { roundAverageRating } from "../../reviews/review.serializer";

export type ProductRating = { averageRating: number; reviewCount: number };

export const readPageRatings = async (
  productIds: Product["id"][],
): Promise<Map<Product["id"], ProductRating>> => {
  if (productIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.review.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, status: ReviewStatus.APPROVED },
    _count: { _all: true },
    _avg: { rating: true },
  });

  return new Map(
    rows.map((row) => [
      row.productId,
      {
        averageRating: roundAverageRating(row._avg.rating),
        reviewCount: row._count._all,
      },
    ]),
  );
};
