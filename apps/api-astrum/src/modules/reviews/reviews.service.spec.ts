jest.mock("../../../lib/prisma", () => ({
  prisma: {
    orderItem: { findFirst: jest.fn() },
    review: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import type { CreateReviewDto } from "./dto/create-review.dto";
import { ReviewsService } from "./reviews.service";

const prismaMock = prisma as unknown as {
  orderItem: { findFirst: jest.Mock };
  review: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    count: jest.Mock;
    aggregate: jest.Mock;
    groupBy: jest.Mock;
  };
};

const dtoFor = (overrides: Partial<CreateReviewDto> = {}): CreateReviewDto =>
  ({
    orderItemId: "line-1",
    rating: 5,
    qualityRating: 4,
    deliveryRating: 3,
    accuracyRating: 5,
    comment: "  solid drill  ",
    ...overrides,
  }) as CreateReviewDto;

const rowFor = (overrides: Record<string, unknown> = {}) => ({
  id: "review-1",
  rating: 5,
  qualityRating: 4,
  deliveryRating: 3,
  accuracyRating: 5,
  comment: "solid drill",
  photos: [],
  likeCount: 0,
  commentCount: 0,
  createdAt: new Date("2026-11-11T10:00:00.000Z"),
  User: { nickName: "Ivan" },
  ...overrides,
});

const answersWith = (error: AppError) => ({
  status: error.status,
  code: error.code,
});

describe("ReviewsService.createReview", () => {
  const service = new ReviewsService();

  beforeEach(() => jest.clearAllMocks());

  const expectRefusal = async (
    promise: Promise<unknown>,
  ): Promise<AppError> => {
    await expect(promise).rejects.toBeInstanceOf(AppError);
    const error = await promise.catch((caught: unknown) => caught);
    return error as AppError;
  };

  it("writes the row under the product from the path with status APPROVED (AC-11)", async () => {
    prismaMock.orderItem.findFirst.mockResolvedValue({
      id: "line-1",
      productId: "product-path",
      status: "DELIVERED",
    });
    prismaMock.review.create.mockResolvedValue(rowFor());

    await service.createReview("user-1", "product-path", dtoFor());

    expect(prismaMock.orderItem.findFirst).toHaveBeenCalledWith({
      where: { id: "line-1", userId: "user-1" },
      select: { id: true, productId: true, status: true },
    });
    expect(prismaMock.review.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        productId: "product-path",
        orderItemId: "line-1",
        rating: 5,
        qualityRating: 4,
        deliveryRating: 3,
        accuracyRating: 5,
        comment: "solid drill",
        photos: [],
        status: "APPROVED",
      },
      select: expect.anything(),
    });
  });

  it("answers the created row in the same shape a list row carries (AC-11)", async () => {
    prismaMock.orderItem.findFirst.mockResolvedValue({
      id: "line-1",
      productId: "product-path",
      status: "DELIVERED",
    });
    prismaMock.review.create.mockResolvedValue(rowFor({ User: null }));

    const review = await service.createReview(
      "user-1",
      "product-path",
      dtoFor(),
    );

    expect(Object.keys(review).sort()).toEqual([
      "accuracyRating",
      "authorName",
      "comment",
      "commentCount",
      "createdAt",
      "deliveryRating",
      "id",
      "likeCount",
      "photos",
      "qualityRating",
      "rating",
    ]);
    expect(review).not.toHaveProperty("orderItemId");
    expect(review).not.toHaveProperty("userId");
    expect(review).not.toHaveProperty("status");
  });

  it("answers 404 REVIEW_ORDER_ITEM_NOT_FOUND for a line of another customer (AC-11)", async () => {
    prismaMock.orderItem.findFirst.mockResolvedValue(null);

    const error = await expectRefusal(
      service.createReview("user-1", "product-path", dtoFor()),
    );

    expect(answersWith(error)).toEqual({
      status: 404,
      code: "REVIEW_ORDER_ITEM_NOT_FOUND",
    });
    expect(prismaMock.review.create).not.toHaveBeenCalled();
  });

  it("answers 403 REVIEW_PRODUCT_MISMATCH for a line of another product (AC-11)", async () => {
    prismaMock.orderItem.findFirst.mockResolvedValue({
      id: "line-1",
      productId: "product-other",
      status: "DELIVERED",
    });

    const error = await expectRefusal(
      service.createReview("user-1", "product-path", dtoFor()),
    );

    expect(answersWith(error)).toEqual({
      status: 403,
      code: "REVIEW_PRODUCT_MISMATCH",
    });
  });

  it("answers 403 REVIEW_ONLY_AFTER_DELIVERY for a line that is not delivered (AC-11)", async () => {
    prismaMock.orderItem.findFirst.mockResolvedValue({
      id: "line-1",
      productId: "product-path",
      status: "SHIPPED",
    });

    const error = await expectRefusal(
      service.createReview("user-1", "product-path", dtoFor()),
    );

    expect(answersWith(error)).toEqual({
      status: 403,
      code: "REVIEW_ONLY_AFTER_DELIVERY",
    });
  });

  it("turns a P2002 on the orderItemId index into 409 REVIEW_ALREADY_EXISTS (AC-11)", async () => {
    prismaMock.orderItem.findFirst.mockResolvedValue({
      id: "line-1",
      productId: "product-path",
      status: "DELIVERED",
    });
    prismaMock.review.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.10.1",
      }),
    );

    const error = await expectRefusal(
      service.createReview("user-1", "product-path", dtoFor()),
    );

    expect(answersWith(error)).toEqual({
      status: 409,
      code: "REVIEW_ALREADY_EXISTS",
    });
  });
});

describe("ReviewsService.getReviewsForProduct", () => {
  const service = new ReviewsService();

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.review.findFirst.mockResolvedValue({ id: "cursor-row" });
    prismaMock.review.count.mockResolvedValue(3);
    prismaMock.review.aggregate.mockResolvedValue({ _avg: { rating: 4.666 } });
    prismaMock.review.groupBy.mockResolvedValue([
      { rating: 5, _count: { _all: 2 } },
      { rating: 3, _count: { _all: 1 } },
    ]);
  });

  it("orders by createdAt then id and asks for one row more than the page (AC-12)", async () => {
    prismaMock.review.findMany.mockResolvedValue([rowFor()]);

    await service.getReviewsForProduct("product-1", { limit: "20" });

    expect(prismaMock.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: "product-1", status: "APPROVED" },
        take: 21,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
  });

  it("drops the extra row, answers the next cursor and keeps the aggregate from the whole set (AC-12)", async () => {
    const rows = Array.from({ length: 3 }, (_, index) =>
      rowFor({
        id: `review-${index}`,
        User: { nickName: index === 1 ? "  " : "Ivan" },
      }),
    );
    prismaMock.review.findMany.mockResolvedValue(rows);

    const page = await service.getReviewsForProduct("product-1", {
      limit: "2",
    });

    expect(page.reviews).toHaveLength(2);
    expect(page.nextCursor).toBe("review-1");
    expect(page.hasNextPage).toBe(true);
    expect(page.aggregate).toEqual({
      total: 3,
      averageRating: 4.67,
      distribution: { "1": 0, "2": 0, "3": 1, "4": 0, "5": 2 },
    });
    expect(page.reviews[1].authorName).toBeNull();
  });

  it("answers no cursor when the extra row did not exist (AC-12)", async () => {
    prismaMock.review.findMany.mockResolvedValue([rowFor()]);

    const page = await service.getReviewsForProduct("product-1", {
      limit: "20",
    });

    expect(page.nextCursor).toBeNull();
    expect(page.hasNextPage).toBe(false);
  });

  it("clamps a limit above the ceiling to 50 (AC-12)", async () => {
    prismaMock.review.findMany.mockResolvedValue([]);

    await service.getReviewsForProduct("product-1", { limit: "999" });

    expect(prismaMock.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 51 }),
    );
  });

  it("answers 400 REVIEW_INVALID_PAGINATION for a limit that is not a number (AC-12)", async () => {
    await expect(
      service.getReviewsForProduct("product-1", { limit: "abc" }),
    ).rejects.toMatchObject({
      status: 400,
      code: "REVIEW_INVALID_PAGINATION",
    });
    expect(prismaMock.review.findMany).not.toHaveBeenCalled();
  });

  it("answers 400 REVIEW_INVALID_CURSOR for an id that is not a review of this product (AC-12)", async () => {
    prismaMock.review.findFirst.mockResolvedValue(null);

    await expect(
      service.getReviewsForProduct("product-1", { after: "bogus" }),
    ).rejects.toMatchObject({
      status: 400,
      code: "REVIEW_INVALID_CURSOR",
    });
    expect(prismaMock.review.findMany).not.toHaveBeenCalled();
  });

  it("reads the page after the cursor, skipping the cursor row (AC-12)", async () => {
    prismaMock.review.findMany.mockResolvedValue([]);

    await service.getReviewsForProduct("product-1", { after: "cursor-row" });

    expect(prismaMock.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "cursor-row" }, skip: 1 }),
    );
  });
});

describe("ReviewsService.getReviewById", () => {
  const service = new ReviewsService();

  beforeEach(() => jest.clearAllMocks());

  it("answers 404 REVIEW_NOT_FOUND instead of a 500 (AC-11)", async () => {
    prismaMock.review.findUnique.mockResolvedValue(null);

    await expect(service.getReviewById("missing")).rejects.toMatchObject({
      status: 404,
      code: "REVIEW_NOT_FOUND",
    });
  });
});
