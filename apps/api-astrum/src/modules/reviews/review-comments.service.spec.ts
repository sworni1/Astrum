jest.mock("../../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    review: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    reviewComment: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

import { prisma } from "../../../lib/prisma";
import { ReviewsService } from "./reviews.service";

type Args = Record<string, any>;

const prismaMock = prisma as unknown as {
  $transaction: jest.Mock;
  review: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  reviewComment: {
    count: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    updateMany: jest.Mock;
  };
};

type StoredComment = {
  id: string;
  reviewId: string;
  userId: string;
  body: string;
  createdAt: Date;
  deletedAt: Date | null;
  nickName: string | null;
};

type Store = {
  reviewExists: boolean;
  reviewStatus: string;
  commentCount: number;
  comments: StoredComment[];
  hourlyCount: number | null;
  failCreate: boolean;
};

const storeFor = (overrides: Partial<Store> = {}): Store => ({
  reviewExists: true,
  reviewStatus: "APPROVED",
  commentCount: 0,
  comments: [],
  hourlyCount: null,
  failCreate: false,
  ...overrides,
});

const commentRow = (comment: StoredComment) => ({
  id: comment.id,
  body: comment.body,
  createdAt: comment.createdAt,
  deletedAt: comment.deletedAt,
  userId: comment.userId,
  User: comment.nickName === null ? null : { nickName: comment.nickName },
});

const wire = (store: Store): void => {
  prismaMock.$transaction.mockImplementation(
    async (run: (tx: unknown) => Promise<unknown>) => run(prismaMock),
  );

  prismaMock.review.findFirst.mockImplementation(async ({ where }: Args) => {
    if (!store.reviewExists) {
      return null;
    }

    if (where.status && where.status !== store.reviewStatus) {
      return null;
    }

    return { id: where.id ?? "review-1" };
  });

  prismaMock.review.findUnique.mockImplementation(async () => ({
    commentCount: store.commentCount,
  }));

  prismaMock.review.update.mockImplementation(async ({ data }: Args) => {
    if (data?.commentCount?.increment) {
      store.commentCount += data.commentCount.increment;
    }

    return { commentCount: store.commentCount };
  });

  prismaMock.review.updateMany.mockImplementation(
    async ({ where, data }: Args) => {
      const floor = where?.commentCount?.gt;

      if (typeof floor === "number" && store.commentCount <= floor) {
        return { count: 0 };
      }

      if (data?.commentCount?.decrement) {
        store.commentCount -= data.commentCount.decrement;
      }

      return { count: 1 };
    },
  );

  prismaMock.reviewComment.count.mockImplementation(async ({ where }: Args) => {
    if (store.hourlyCount !== null) {
      return store.hourlyCount;
    }

    return store.comments.filter(
      (comment) =>
        comment.userId === where.userId &&
        comment.createdAt >= new Date(where.createdAt.gte),
    ).length;
  });

  prismaMock.reviewComment.create.mockImplementation(async ({ data }: Args) => {
    if (store.failCreate) {
      throw new Error("insert refused");
    }

    const comment: StoredComment = {
      id: `comment-${store.comments.length + 1}`,
      reviewId: data.reviewId,
      userId: data.userId,
      body: data.body,
      createdAt: new Date("2026-11-12T10:00:00.000Z"),
      deletedAt: null,
      nickName: "Ivan",
    };

    store.comments.push(comment);
    return commentRow(comment);
  });

  prismaMock.reviewComment.findFirst.mockImplementation(
    async ({ where }: Args) => {
      const found = store.comments.find(
        (comment) =>
          comment.id === where.id && comment.reviewId === where.reviewId,
      );

      return found ? { id: found.id, userId: found.userId } : null;
    },
  );

  prismaMock.reviewComment.findUnique.mockImplementation(
    async ({ where }: Args) => {
      const found = store.comments.find((comment) => comment.id === where.id);

      return found ? commentRow(found) : null;
    },
  );

  prismaMock.reviewComment.findMany.mockImplementation(
    async ({ take, cursor, skip }: Args) => {
      const ordered = [...store.comments].sort((left, right) => {
        const byDate = left.createdAt.getTime() - right.createdAt.getTime();

        return byDate !== 0 ? byDate : left.id.localeCompare(right.id);
      });
      const start = cursor
        ? ordered.findIndex((comment) => comment.id === cursor.id) + (skip ?? 0)
        : 0;

      return ordered.slice(start, start + take).map(commentRow);
    },
  );

  prismaMock.reviewComment.updateMany.mockImplementation(
    async ({ where, data }: Args) => {
      const found = store.comments.find(
        (comment) =>
          comment.id === where.id &&
          comment.reviewId === where.reviewId &&
          comment.userId === where.userId &&
          (where.deletedAt !== null || comment.deletedAt === null),
      );

      if (!found) {
        return { count: 0 };
      }

      found.deletedAt = data.deletedAt;
      return { count: 1 };
    },
  );
};

const commentBody = (body: string) => ({ body }) as never;

describe("ReviewsService comment reads (spec 0014)", () => {
  const service = new ReviewsService();

  beforeEach(() => jest.clearAllMocks());

  it("reads one row more than the page, oldest first, ten by default (AC-7)", async () => {
    const store = storeFor();
    wire(store);

    await service.getReviewComments("review-1", "user-1");

    expect(prismaMock.reviewComment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reviewId: "review-1" },
        take: 11,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("drops the extra row and answers the cursor only while pages remain (AC-7)", async () => {
    const store = storeFor({
      comments: Array.from({ length: 3 }, (_, index) => ({
        id: `comment-${index + 1}`,
        reviewId: "review-1",
        userId: "user-1",
        body: `body ${index}`,
        createdAt: new Date(`2026-11-12T0${index}:00:00.000Z`),
        deletedAt: null,
        nickName: "Ivan",
      })),
    });
    wire(store);

    const page = await service.getReviewComments("review-1", "user-1", {
      limit: "2",
    });

    expect(page.comments).toHaveLength(2);
    expect(page.hasNextPage).toBe(true);
    expect(page.nextCursor).toBe("comment-2");

    const last = await service.getReviewComments("review-1", "user-1", {
      limit: "5",
    });

    expect(last.comments).toHaveLength(3);
    expect(last.hasNextPage).toBe(false);
    expect(last.nextCursor).toBeNull();
  });

  it("clamps the limit to 50 above the ceiling and to 1 below it (AC-7)", async () => {
    const store = storeFor();
    wire(store);

    await service.getReviewComments("review-1", "user-1", { limit: "999" });
    expect(prismaMock.reviewComment.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 51 }),
    );

    await service.getReviewComments("review-1", "user-1", { limit: "0" });
    expect(prismaMock.reviewComment.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 2 }),
    );
  });

  it("answers 400 REVIEW_INVALID_PAGINATION for a limit that is not a number (AC-7)", async () => {
    const store = storeFor();
    wire(store);

    await expect(
      service.getReviewComments("review-1", "user-1", { limit: "abc" }),
    ).rejects.toMatchObject({
      status: 400,
      code: "REVIEW_INVALID_PAGINATION",
    });
  });

  it("answers 400 REVIEW_INVALID_CURSOR for a comment of another review (AC-7)", async () => {
    const store = storeFor();
    wire(store);

    await expect(
      service.getReviewComments("review-1", "user-1", { after: "bogus" }),
    ).rejects.toMatchObject({ status: 400, code: "REVIEW_INVALID_CURSOR" });
    expect(prismaMock.reviewComment.findMany).not.toHaveBeenCalled();
  });

  it("answers the page after the cursor, skipping the cursor row (AC-7)", async () => {
    const store = storeFor({
      comments: [
        {
          id: "comment-1",
          reviewId: "review-1",
          userId: "user-1",
          body: "first",
          createdAt: new Date("2026-11-12T09:00:00.000Z"),
          deletedAt: null,
          nickName: "Ivan",
        },
        {
          id: "comment-2",
          reviewId: "review-1",
          userId: "user-1",
          body: "second",
          createdAt: new Date("2026-11-12T10:00:00.000Z"),
          deletedAt: null,
          nickName: "Ivan",
        },
      ],
    });
    wire(store);

    const page = await service.getReviewComments("review-1", "user-1", {
      after: "comment-1",
    });

    expect(page.comments.map((comment) => comment.id)).toEqual(["comment-2"]);
  });

  it("answers no text and no author for a deleted row (AC-7, AC-10)", async () => {
    const store = storeFor({
      comments: [
        {
          id: "comment-1",
          reviewId: "review-1",
          userId: "user-1",
          body: "gone",
          createdAt: new Date("2026-11-12T09:00:00.000Z"),
          deletedAt: new Date("2026-11-12T10:00:00.000Z"),
          nickName: "Ivan",
        },
      ],
    });
    wire(store);

    const page = await service.getReviewComments("review-1", "user-1");

    expect(page.comments[0]).toMatchObject({
      body: null,
      authorName: null,
      mine: true,
    });
    expect(page.comments[0]).not.toHaveProperty("userId");
  });

  it("marks a row as mine only for its author (AC-7)", async () => {
    const store = storeFor({
      comments: [
        {
          id: "comment-1",
          reviewId: "review-1",
          userId: "user-1",
          body: "mine",
          createdAt: new Date("2026-11-12T09:00:00.000Z"),
          deletedAt: null,
          nickName: "Ivan",
        },
        {
          id: "comment-2",
          reviewId: "review-1",
          userId: "user-2",
          body: "theirs",
          createdAt: new Date("2026-11-12T10:00:00.000Z"),
          deletedAt: null,
          nickName: "Petr",
        },
      ],
    });
    wire(store);

    const page = await service.getReviewComments("review-1", "user-1");

    expect(page.comments.map((comment) => comment.mine)).toEqual([true, false]);
  });

  it("answers 404 REVIEW_NOT_FOUND for a missing or unapproved review (AC-7)", async () => {
    const store = storeFor({ reviewStatus: "PENDING" });
    wire(store);

    await expect(
      service.getReviewComments("review-1", "user-1"),
    ).rejects.toMatchObject({ status: 404, code: "REVIEW_NOT_FOUND" });

    store.reviewExists = false;

    await expect(
      service.getReviewComments("review-1", "user-1"),
    ).rejects.toMatchObject({ status: 404, code: "REVIEW_NOT_FOUND" });
  });
});

describe("ReviewsService comment writes (spec 0014)", () => {
  const service = new ReviewsService();

  beforeEach(() => jest.clearAllMocks());

  it("answers 201 with the row in the list shape and the counter (AC-8)", async () => {
    const store = storeFor();
    wire(store);

    const answer = await service.createReviewComment(
      "user-1",
      "review-1",
      commentBody("  a valid reply  "),
    );

    expect(answer.comment).toMatchObject({
      body: "a valid reply",
      authorName: "Ivan",
      mine: true,
      deletedAt: null,
    });
    expect(answer.comment).not.toHaveProperty("userId");
    expect(answer.commentCount).toBe(1);
    expect(store.commentCount).toBe(1);
  });

  it("counts deleted rows against the hourly budget and refuses the eleventh with 429 (AC-9)", async () => {
    const store = storeFor({ hourlyCount: 10 });
    wire(store);

    await expect(
      service.createReviewComment(
        "user-1",
        "review-1",
        commentBody("one more"),
      ),
    ).rejects.toMatchObject({
      status: 429,
      code: "REVIEW_COMMENT_RATE_LIMITED",
    });
    expect(prismaMock.reviewComment.create).not.toHaveBeenCalled();
    expect(store.commentCount).toBe(0);
  });

  it("counts the caller's rows from the last hour for the budget (AC-9)", async () => {
    const store = storeFor({
      comments: [
        {
          id: "comment-1",
          reviewId: "review-1",
          userId: "user-1",
          body: "recent",
          createdAt: new Date(),
          deletedAt: null,
          nickName: "Ivan",
        },
      ],
    });
    wire(store);

    await service.createReviewComment(
      "user-1",
      "review-1",
      commentBody("next"),
    );

    expect(prismaMock.reviewComment.count).toHaveBeenCalledWith({
      where: { userId: "user-1", createdAt: { gte: expect.any(Date) } },
    });
  });

  it("leaves the counter untouched when the insert fails (AC-8)", async () => {
    const store = storeFor({ failCreate: true });
    wire(store);

    await expect(
      service.createReviewComment("user-1", "review-1", commentBody("a reply")),
    ).rejects.toThrow("insert refused");

    expect(prismaMock.review.update).not.toHaveBeenCalled();
    expect(store.commentCount).toBe(0);
  });

  it("answers 404 REVIEW_NOT_FOUND when the review is not approved (AC-5)", async () => {
    const store = storeFor({ reviewStatus: "REJECTED" });
    wire(store);

    await expect(
      service.createReviewComment("user-1", "review-1", commentBody("a reply")),
    ).rejects.toMatchObject({ status: 404, code: "REVIEW_NOT_FOUND" });
  });

  it("answers 403 REVIEW_COMMENT_FORBIDDEN for another customer's comment (AC-10)", async () => {
    const store = storeFor({
      commentCount: 1,
      comments: [
        {
          id: "comment-1",
          reviewId: "review-1",
          userId: "user-2",
          body: "theirs",
          createdAt: new Date("2026-11-12T09:00:00.000Z"),
          deletedAt: null,
          nickName: "Petr",
        },
      ],
    });
    wire(store);

    await expect(
      service.deleteReviewComment("user-1", "review-1", "comment-1"),
    ).rejects.toMatchObject({
      status: 403,
      code: "REVIEW_COMMENT_FORBIDDEN",
    });
    expect(store.comments[0].deletedAt).toBeNull();
    expect(store.commentCount).toBe(1);
  });

  it("answers 404 REVIEW_COMMENT_NOT_FOUND for a comment of another review (AC-10)", async () => {
    const store = storeFor();
    wire(store);

    await expect(
      service.deleteReviewComment("user-1", "review-1", "comment-9"),
    ).rejects.toMatchObject({
      status: 404,
      code: "REVIEW_COMMENT_NOT_FOUND",
    });
  });

  it("soft deletes the author's row and answers the stub with the counter (AC-10)", async () => {
    const store = storeFor({
      commentCount: 1,
      comments: [
        {
          id: "comment-1",
          reviewId: "review-1",
          userId: "user-1",
          body: "mine",
          createdAt: new Date("2026-11-12T09:00:00.000Z"),
          deletedAt: null,
          nickName: "Ivan",
        },
      ],
    });
    wire(store);

    const answer = await service.deleteReviewComment(
      "user-1",
      "review-1",
      "comment-1",
    );

    expect(answer.comment).toMatchObject({
      id: "comment-1",
      body: null,
      authorName: null,
      mine: true,
    });
    expect(answer.commentCount).toBe(0);
    expect(store.commentCount).toBe(0);
  });

  it("is idempotent: a repeat answers the identical stub and the same counter (AC-10)", async () => {
    const store = storeFor({
      commentCount: 1,
      comments: [
        {
          id: "comment-1",
          reviewId: "review-1",
          userId: "user-1",
          body: "mine",
          createdAt: new Date("2026-11-12T09:00:00.000Z"),
          deletedAt: null,
          nickName: "Ivan",
        },
      ],
    });
    wire(store);

    const first = await service.deleteReviewComment(
      "user-1",
      "review-1",
      "comment-1",
    );
    const second = await service.deleteReviewComment(
      "user-1",
      "review-1",
      "comment-1",
    );

    expect(second.comment).toEqual(first.comment);
    expect(second.commentCount).toBe(first.commentCount);
    expect(store.commentCount).toBe(0);
  });

  it("deletes a comment whatever the review status, so it never sticks (AC-5)", async () => {
    const store = storeFor({
      reviewStatus: "REJECTED",
      commentCount: 1,
      comments: [
        {
          id: "comment-1",
          reviewId: "review-1",
          userId: "user-1",
          body: "mine",
          createdAt: new Date("2026-11-12T09:00:00.000Z"),
          deletedAt: null,
          nickName: "Ivan",
        },
      ],
    });
    wire(store);

    await expect(
      service.deleteReviewComment("user-1", "review-1", "comment-1"),
    ).resolves.toMatchObject({ commentCount: 0 });
  });
});
