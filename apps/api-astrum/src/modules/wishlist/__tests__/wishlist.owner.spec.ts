jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    product: { findMany: jest.fn(), findFirst: jest.fn() },
    cartItem: { findUnique: jest.fn(), findMany: jest.fn() },
    wishlistItem: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

import { prisma } from "../../../../lib/prisma";
import { guestOwner } from "../../../common/types/owner";
import { WishlistService } from "../wishlist.service";

type Row = {
  productId: string;
  userId?: string | null;
  guestId?: string | null;
};

const rows: Row[] = [];

const ofOwner = (
  row: Row,
  where: { userId?: string; guestId?: string },
): boolean =>
  where.userId !== undefined
    ? row.userId === where.userId
    : row.guestId === where.guestId;

const ownerOnly = (where: {
  productId: string;
  userId?: string;
  guestId?: string;
}) => {
  const { productId: _productId, ...owner } = where;

  return owner;
};

const ownerOf = (
  where: Record<
    string,
    { productId: string; userId?: string; guestId?: string }
  >,
) => Object.values(where)[0];

const mock = prisma as unknown as {
  product: { findMany: jest.Mock; findFirst: jest.Mock };
  cartItem: { findUnique: jest.Mock; findMany: jest.Mock };
  wishlistItem: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    upsert: jest.Mock;
    deleteMany: jest.Mock;
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  rows.length = 0;

  mock.product.findMany.mockImplementation(
    async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({
        id,
        name: `name-${id}`,
        previewImage: null,
        price: 10,
      })),
  );
  mock.product.findFirst.mockResolvedValue({ id: "p1" });
  mock.cartItem.findUnique.mockResolvedValue(null);
  mock.cartItem.findMany.mockResolvedValue([]);
  mock.wishlistItem.findMany.mockImplementation(
    async ({ where }: { where: Record<string, unknown> }) =>
      rows
        .filter((row) => ofOwner(row, where))
        .map((row) => ({ productId: row.productId })),
  );
  mock.wishlistItem.findUnique.mockImplementation(
    async ({ where }: { where: Record<string, { productId: string }> }) => {
      const ownerWhere = ownerOf(where);
      const { productId } = ownerWhere;

      return (
        rows.find(
          (row) =>
            row.productId === productId && ofOwner(row, ownerOnly(ownerWhere)),
        ) ?? null
      );
    },
  );
  mock.wishlistItem.upsert.mockImplementation(
    async ({
      where,
      create,
    }: {
      where: Record<
        string,
        { productId: string; userId?: string; guestId?: string }
      >;
      create: Row;
    }) => {
      const ownerWhere = Object.values(where)[0];
      const { productId } = ownerWhere;
      const existing = rows.find(
        (row) =>
          row.productId === productId && ofOwner(row, ownerOnly(ownerWhere)),
      );

      if (existing) {
        return { id: "row", productId, createdAt: new Date(0) };
      }

      rows.push({ ...create });

      return { id: "row", productId, createdAt: new Date(0) };
    },
  );
  mock.wishlistItem.deleteMany.mockImplementation(
    async ({
      where,
    }: {
      where: { productId: string; userId?: string; guestId?: string };
    }) => {
      const before = rows.length;

      for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];

        if (row.productId === where.productId && ofOwner(row, where)) {
          rows.splice(index, 1);
        }
      }

      return { count: before - rows.length };
    },
  );
});

describe("WishlistService with two kinds of owner", () => {
  it("answers an empty wishlist to a reader with no identity (AC-6)", async () => {
    await expect(new WishlistService().getWishlist(null)).resolves.toEqual([]);
    expect(mock.wishlistItem.findMany).not.toHaveBeenCalled();
  });

  it("leaves one row and answers 200 on a repeated add (AC-10)", async () => {
    const service = new WishlistService();

    const first = await service.addProductToWishlist(guestOwner("guest-1"), {
      productId: "p1",
    });
    const second = await service.addProductToWishlist(guestOwner("guest-1"), {
      productId: "p1",
    });

    expect(first).toMatchObject({ isWishlisted: true, quantityInCart: 0 });
    expect(second).toMatchObject({ isWishlisted: true });
    expect(rows).toEqual([{ productId: "p1", guestId: "guest-1" }]);
    expect(mock.wishlistItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { guestId_productId: { guestId: "guest-1", productId: "p1" } },
        update: {},
      }),
    );
  });

  it("deletes through the guest key only (AC-4)", async () => {
    rows.push({ productId: "p1", guestId: "guest-1" });
    rows.push({ productId: "p1", userId: "user-1" });

    await new WishlistService().deleteProductFromWishlist(
      guestOwner("guest-1"),
      "p1",
    );

    expect(rows).toEqual([{ productId: "p1", userId: "user-1" }]);
    expect(mock.wishlistItem.deleteMany).toHaveBeenCalledWith({
      where: { guestId: "guest-1", productId: "p1" },
    });
  });

  it("reads the guest lines with their cart marks (AC-8)", async () => {
    rows.push({ productId: "p1", guestId: "guest-1" });
    mock.cartItem.findMany.mockResolvedValue([
      { productId: "p1", quantity: 2 },
    ]);

    const wishlist = await new WishlistService().getWishlist(
      guestOwner("guest-1"),
    );

    expect(wishlist).toHaveLength(1);
    expect(wishlist[0]).toMatchObject({
      id: "p1",
      isWishlisted: true,
      quantityInCart: 2,
    });
  });
});
