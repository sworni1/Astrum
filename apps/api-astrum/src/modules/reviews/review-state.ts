import { OrderItemStatus } from "@astrum/db/enums";
import { prisma } from "../../../lib/prisma";
import type { Owner } from "../../common/types/owner";

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

export const readReviewState = async (
  owner: Owner | null,
  productId: string,
): Promise<ReviewState> => {
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
