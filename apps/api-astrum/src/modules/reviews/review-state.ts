import { OrderItemStatus } from "@astrum/db/enums";
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
 * Derived on every read, never stored (spec 0012, AC-7). `ELIGIBLE` needs a line
 * this customer was handed for this product that carries no review yet, so a
 * parcel that arrived but was never issued offers none (spec 0031, AC-6); when
 * several do, the line whose order was created last wins, ties by line id.
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

  const issuedLine = await prisma.orderItem.findFirst({
    where: {
      userId,
      productId,
      status: OrderItemStatus.ISSUED,
      review: { is: null },
    },
    orderBy: [{ order: { createdAt: "desc" } }, { id: "asc" }],
    select: { id: true },
  });

  if (issuedLine) {
    return {
      status: REVIEW_STATE_STATUS.eligible,
      orderItemId: issuedLine.id,
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
