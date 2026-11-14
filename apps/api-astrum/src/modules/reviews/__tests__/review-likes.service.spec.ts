jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    reviewLike: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    review: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

import { prisma } from "../../../../lib/prisma";
import { ReviewsService } from "../reviews.service";

type Args = Record<string, any>;

const prismaMock = prisma as unknown as {
  $transaction: jest.Mock;
  reviewLike: {
    createMany: jest.Mock;
    deleteMany: jest.Mock;
    findMany: jest.Mock;
  };
  review: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
};

/**
 * A tiny stateful client: the counter lives beside the like rows, so a test
 * can prove the two agree after any sequence of presses (AC-4).
 */
type Store = {
  exists: boolean;
  status: string;
  likeCount: number;
  likes: string[];
};

const storeFor = (overrides: Partial<Store> = {}): Store => ({
  exists: true,
  status: "APPROVED",
  likeCount: 0,
  likes: [],
  ...overrides,
});

const wire = (store: Store): void => {
  prismaMock.$transaction.mockImplementation(
    async (run: (tx: unknown) => Promise<unknown>) => run(prismaMock),
  );

  prismaMock.review.findFirst.mockImplementation(async ({ where }: Args) => {
    if (!store.exists) {
      return null;
    }

    if (where.status && where.status !== store.status) {
      return null;
    }

    return { id: where.id };
  });

  prismaMock.reviewLike.createMany.mockImplementation(
    async ({ data }: Args) => {
      let count = 0;

      for (const row of data as { reviewId: string; userId: string }[]) {
        const key = `${row.reviewId}:${row.userId}`;

        if (!store.likes.includes(key)) {
          store.likes.push(key);
          count += 1;
        }
      }

      return { count };
    },
  );

  prismaMock.reviewLike.deleteMany.mockImplementation(
    async ({ where }: Args) => {
      const key = `${where.reviewId}:${where.userId}`;
      const index = store.likes.indexOf(key);

      if (index < 0) {
        return { count: 0 };
      }

      store.likes.splice(index, 1);
      return { count: 1 };
    },
  );

  prismaMock.review.update.mockImplementation(async ({ data }: Args) => {
    if (data?.likeCount?.increment) {
      store.likeCount += data.likeCount.increment;
    }

    return { likeCount: store.likeCount };
  });

  prismaMock.review.updateMany.mockImplementation(
    async ({ where, data }: Args) => {
      const floor = where?.likeCount?.gt;

      if (typeof floor === "number" && store.likeCount <= floor) {
        return { count: 0 };
      }

      if (data?.likeCount?.decrement) {
        store.likeCount -= data.likeCount.decrement;
      }

      return { count: 1 };
    },
  );

  prismaMock.review.findUnique.mockImplementation(async () => ({
    likeCount: store.likeCount,
    commentCount: 0,
  }));
};

describe("ReviewsService like routes (spec 0014)", () => {
  const service = new ReviewsService();

  beforeEach(() => jest.clearAllMocks());

  it("answers 200 with the incremented counter on the first like (AC-4)", async () => {
    const store = storeFor();
    wire(store);

    const answer = await service.likeReview("user-1", "review-1");

    expect(answer).toEqual({ liked: true, likeCount: 1 });
    expect(store.likes).toEqual(["review-1:user-1"]);
  });

  it("answers the same number on a repeated PUT and writes no second row (AC-4)", async () => {
    const store = storeFor();
    wire(store);

    const first = await service.likeReview("user-1", "review-1");
    const second = await service.likeReview("user-1", "review-1");

    expect(first).toEqual(second);
    expect(store.likes).toHaveLength(1);
    expect(store.likeCount).toBe(1);
  });

  it("never throws a duplicate error: the unique pair is the guard (AC-4)", async () => {
    const store = storeFor();
    wire(store);

    await expect(service.likeReview("user-1", "review-1")).resolves.toEqual({
      liked: true,
      likeCount: 1,
    });
    await expect(service.likeReview("user-1", "review-1")).resolves.toEqual({
      liked: true,
      likeCount: 1,
    });
  });

  it("decrements once on an unlike and answers the same number twice (AC-4)", async () => {
    const store = storeFor({ likeCount: 1, likes: ["review-1:user-1"] });
    wire(store);

    const first = await service.unlikeReview("user-1", "review-1");
    const second = await service.unlikeReview("user-1", "review-1");

    expect(first).toEqual({ liked: false, likeCount: 0 });
    expect(second).toEqual({ liked: false, likeCount: 0 });
    expect(store.likes).toHaveLength(0);
    expect(store.likeCount).toBe(0);
  });

  it("never answers a negative counter for a repeated DELETE (AC-4)", async () => {
    const store = storeFor({ likeCount: 0, likes: [] });
    wire(store);

    const answer = await service.unlikeReview("user-1", "review-1");

    expect(answer.likeCount).toBe(0);
    expect(store.likeCount).toBe(0);
  });

  it("keeps the counter equal to the child row count after mixed presses (AC-4)", async () => {
    const store = storeFor();
    wire(store);

    await service.likeReview("user-1", "review-1");
    await service.likeReview("user-2", "review-1");
    await service.likeReview("user-1", "review-1");
    await service.unlikeReview("user-2", "review-1");
    await service.unlikeReview("user-2", "review-1");

    expect(store.likes).toHaveLength(1);
    expect(store.likeCount).toBe(store.likes.length);

    const answered = await service.likeReview("user-3", "review-1");

    expect(answered.likeCount).toBe(store.likes.length);
  });

  it("answers 404 REVIEW_NOT_FOUND for a review that is not approved (AC-5)", async () => {
    const store = storeFor({ status: "REJECTED" });
    wire(store);

    await expect(
      service.likeReview("user-1", "review-1"),
    ).rejects.toMatchObject({
      status: 404,
      code: "REVIEW_NOT_FOUND",
    });
    expect(prismaMock.reviewLike.createMany).not.toHaveBeenCalled();
  });

  it("answers 404 REVIEW_NOT_FOUND for a missing review on the like and the unlike (AC-5)", async () => {
    const store = storeFor({ exists: false });
    wire(store);

    await expect(
      service.likeReview("user-1", "review-1"),
    ).rejects.toMatchObject({
      status: 404,
      code: "REVIEW_NOT_FOUND",
    });
    await expect(
      service.unlikeReview("user-1", "review-1"),
    ).rejects.toMatchObject({ status: 404, code: "REVIEW_NOT_FOUND" });
  });

  it("unlikes a review whatever its status, so a like can be withdrawn (AC-5)", async () => {
    const store = storeFor({
      status: "REJECTED",
      likeCount: 1,
      likes: ["review-1:user-1"],
    });
    wire(store);

    const answer = await service.unlikeReview("user-1", "review-1");

    expect(answer).toEqual({ liked: false, likeCount: 0 });
  });

  it("reads the liked set of this product's approved reviews, oldest first (AC-3)", async () => {
    prismaMock.reviewLike.findMany.mockResolvedValue([
      { reviewId: "review-1" },
      { reviewId: "review-2" },
    ]);

    const answer = await service.getLikedReviewIds("user-1", "product-1");

    expect(answer).toEqual({ reviewIds: ["review-1", "review-2"] });
    expect(prismaMock.reviewLike.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        Review: { productId: "product-1", status: "APPROVED" },
      },
      select: { reviewId: true },
      orderBy: { createdAt: "asc" },
    });
  });

  it("answers an empty set instead of a 404 for a product with no likes (AC-3)", async () => {
    prismaMock.reviewLike.findMany.mockResolvedValue([]);

    await expect(
      service.getLikedReviewIds("user-1", "product-1"),
    ).resolves.toEqual({ reviewIds: [] });
  });
});
