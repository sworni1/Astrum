jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    product: { findMany: jest.fn() },
    review: { groupBy: jest.fn() },
    cartItem: { findMany: jest.fn() },
    wishlistItem: { findMany: jest.fn() },
  },
}));

jest.mock("../../../cache/cache", () => {
  const payloads = new Map<string, string>();

  return {
    getOrSet: async ({
      key,
      load,
    }: {
      key: string;
      load: () => Promise<unknown>;
    }) => {
      const held = payloads.get(key);

      if (held !== undefined) {
        return JSON.parse(held);
      }

      const value = await load();
      const payload = JSON.stringify(value);

      payloads.set(key, payload);

      return JSON.parse(payload);
    },
    readVersion: async () => 0,
    listTtlSeconds: () => 30,
    productTtlSeconds: () => 60,
    invalidateLists: async () => undefined,
    invalidateReviews: async () => undefined,
    invalidateProducts: async () => undefined,
    invalidateShipping: async () => undefined,
  };
});

import { prisma } from "../../../../lib/prisma";
import { userOwner } from "../../../common/types/owner";
import { ProductService } from "../product.service";

type Mocked = jest.Mock;

const prismaMock = prisma as unknown as {
  product: { findMany: Mocked };
  review: { groupBy: Mocked };
  cartItem: { findMany: Mocked };
  wishlistItem: { findMany: Mocked };
};

const queryCount = (): number =>
  prismaMock.product.findMany.mock.calls.length +
  prismaMock.review.groupBy.mock.calls.length +
  prismaMock.cartItem.findMany.mock.calls.length +
  prismaMock.wishlistItem.findMany.mock.calls.length;

const page = (count: number) =>
  Array.from({ length: count }, (_unused, index) => ({
    id: `p${index + 1}`,
    name: `Product ${index + 1}`,
    previewImage: null,
    images: [],
    quantity: 5,
    price: "10.00",
    isOutOfStock: false,
    discount: 0,
    stars: 0,
    currency: "RUB",
  }));

const CURSOR_MISS = "cursor-miss-then-hit";
const CURSOR_AGGREGATE = "cursor-aggregate";
const CURSOR_MARKS = "cursor-marks";
const CURSOR_ACCOUNT = "cursor-account";

describe("ProductService.getRecommendations", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    prismaMock.product.findMany.mockResolvedValue(page(8));
    prismaMock.review.groupBy.mockResolvedValue([
      { productId: "p1", _count: { _all: 2 }, _avg: { rating: 4.5 } },
    ]);
    prismaMock.cartItem.findMany.mockResolvedValue([]);
    prismaMock.wishlistItem.findMany.mockResolvedValue([]);
  });

  it("costs four queries on a miss and two on a hit for a page of eight (AC-4)", async () => {
    const service = new ProductService();

    const first = await service.getRecommendations(
      userOwner("user-1"),
      {},
      CURSOR_MISS,
      8,
    );

    expect(queryCount()).toBe(4);
    expect(first.products).toHaveLength(8);

    const second = await service.getRecommendations(
      userOwner("user-1"),
      {},
      CURSOR_MISS,
      8,
    );

    expect(queryCount()).toBe(6);
    expect(second).toEqual(first);
  });

  it("reads the rating of the page in one grouped query, never one per card (AC-4)", async () => {
    await new ProductService().getRecommendations(
      userOwner("user-1"),
      {},
      CURSOR_AGGREGATE,
      8,
    );

    expect(prismaMock.review.groupBy).toHaveBeenCalledTimes(1);
    expect(prismaMock.review.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["productId"],
        where: expect.objectContaining({
          productId: { in: page(8).map((product) => product.id) },
        }),
      }),
    );
  });

  it("merges each caller's own marks over one cached page (AC-3)", async () => {
    prismaMock.cartItem.findMany.mockImplementation(
      async ({ where }: { where: { userId: string } }) =>
        where.userId === "user-1" ? [{ productId: "p1", quantity: 2 }] : [],
    );
    prismaMock.wishlistItem.findMany.mockImplementation(
      async ({ where }: { where: { userId: string } }) =>
        where.userId === "user-1" ? [{ productId: "p2" }] : [],
    );
    const service = new ProductService();

    const mine = await service.getRecommendations(
      userOwner("user-1"),
      {},
      CURSOR_MARKS,
    );
    const theirs = await service.getRecommendations(
      userOwner("user-2"),
      {},
      CURSOR_MARKS,
    );

    expect(mine.products[0]).toMatchObject({
      isWishlisted: false,
      quantityInCart: 2,
    });
    expect(mine.products[1]).toMatchObject({
      isWishlisted: true,
      quantityInCart: 0,
    });
    expect(theirs.products[0]).toMatchObject({
      isWishlisted: false,
      quantityInCart: 0,
    });
    expect(theirs.products[1]).toMatchObject({
      isWishlisted: false,
      quantityInCart: 0,
    });
    expect(theirs.nextCursor).toBe(mine.nextCursor);
    expect(theirs.products).toHaveLength(8);
  });

  it("keeps the cache key free of any account (AC-3)", async () => {
    const service = new ProductService();

    const mine = await service.getRecommendations(
      userOwner("user-1"),
      {},
      CURSOR_ACCOUNT,
    );
    const theirs = await service.getRecommendations(
      userOwner("user-2"),
      {},
      CURSOR_ACCOUNT,
    );

    expect(theirs.nextCursor).toBe(mine.nextCursor);

    expect(prismaMock.product.findMany).toHaveBeenCalledTimes(1);
  });
});
