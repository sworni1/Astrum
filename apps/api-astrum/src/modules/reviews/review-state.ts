import { OrderItemStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../../lib/prisma";
import type { Owner } from "../../common/types/owner";

/** The three answers the storefront knows; anything else renders no control. */
export const REVIEW_STATE_STATUS = {
  eligible: "ELIGIBLE",
  notPurchased: "NOT_PURCHASED",
  alreadyReviewed: "ALREADY_REVIEWED",
} as const;

export type ReviewStateStatus =
  (typeof REVIEW_STATE_STATUS)[keyof typeof REVIEW_STATE_STATUS];

export type ReviewState = {
  status: ReviewStateStatus;
  orderItemId: string | null;
};

/**
 * Derived on every read, never stored (spec 0012, AC-7). `ELIGIBLE` needs a
 * delivered line of this customer and this product that carries no review yet;
 * when several do, the line whose order was created last wins, ties by line id.
 */
export const readReviewState = async (
  owner: Owner | null,
  productId: string,
): Promise<ReviewState> => {
  // A visitor with no account has no order behind it, so nothing is filterable
  // on an undefined id (spec 0028, AC-6).
  if (!owner || owner.kind !== "user") {
    return { status: REVIEW_STATE_STATUS.notPurchased, orderItemId: null };
  }

  const { userId } = owner;

  const deliveredLine = await prisma.orderItem.findFirst({
    where: {
      userId,
      productId,
      status: OrderItemStatus.DELIVERED,
      review: { is: null },
    },
    orderBy: [{ order: { createdAt: "desc" } }, { id: "asc" }],
    select: { id: true },
  });

  if (deliveredLine) {
    return {
      status: REVIEW_STATE_STATUS.eligible,
      orderItemId: deliveredLine.id,
    };
  }

  const writtenReview = await prisma.review.findFirst({
    where: { userId, productId },
    select: { id: true },
  });

  return writtenReview
    ? { status: REVIEW_STATE_STATUS.alreadyReviewed, orderItemId: null }
    : { status: REVIEW_STATE_STATUS.notPurchased, orderItemId: null };
};
