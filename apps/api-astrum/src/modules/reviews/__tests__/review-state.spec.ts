jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    orderItem: { findFirst: jest.fn() },
    review: { findFirst: jest.fn() },
  },
}));

import { prisma } from "../../../../lib/prisma";
import { userOwner } from "../../../common/types/owner";
import { readReviewState } from "../review-state";

const prismaMock = prisma as unknown as {
  orderItem: { findFirst: jest.Mock };
  review: { findFirst: jest.Mock };
};

describe("readReviewState", () => {
  beforeEach(() => jest.clearAllMocks());

  it("answers ELIGIBLE with the line of the newest order that carries no review (AC-7, spec 0031 AC-6)", async () => {
    prismaMock.orderItem.findFirst.mockResolvedValue({ id: "line-newest" });

    const state = await readReviewState(userOwner("user-1"), "product-1");

    expect(state).toEqual({ status: "ELIGIBLE", orderItemId: "line-newest" });
    expect(prismaMock.orderItem.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        productId: "product-1",
        status: "ISSUED",
        review: { is: null },
      },
      orderBy: [{ order: { createdAt: "desc" } }, { id: "asc" }],
      select: { id: true },
    });
  });

  it("answers ALREADY_REVIEWED when every issued line is reviewed (AC-7)", async () => {
    prismaMock.orderItem.findFirst.mockResolvedValue(null);
    prismaMock.review.findFirst.mockResolvedValue({ id: "review-1" });

    const state = await readReviewState(userOwner("user-1"), "product-1");

    expect(state).toEqual({ status: "ALREADY_REVIEWED", orderItemId: null });
  });

  it("answers NOT_PURCHASED when the customer never bought the product (AC-7)", async () => {
    prismaMock.orderItem.findFirst.mockResolvedValue(null);
    prismaMock.review.findFirst.mockResolvedValue(null);

    const state = await readReviewState(userOwner("user-1"), "product-1");

    expect(state).toEqual({ status: "NOT_PURCHASED", orderItemId: null });
  });
});
