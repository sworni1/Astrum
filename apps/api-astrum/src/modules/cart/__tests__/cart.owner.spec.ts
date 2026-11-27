jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    product: { findMany: jest.fn(), findUnique: jest.fn() },
    cartItem: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    wishlistItem: { findUnique: jest.fn(), findMany: jest.fn() },
    orderItem: { findFirst: jest.fn() },
    review: { groupBy: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("../../../cache/cache", () => ({
  getOrSet: async ({ load }: { load: () => Promise<unknown> }) => await load(),
  readVersion: async () => 0,
  listTtlSeconds: () => 30,
  productTtlSeconds: () => 60,
  invalidateLists: async () => undefined,
  invalidateReviews: async () => undefined,
  invalidateProducts: async () => undefined,
  invalidateShipping: async () => undefined,
}));

import { prisma } from "../../../../lib/prisma";
import { guestOwner, userOwner } from "../../../common/types/owner";
import { CartService } from "../cart.service";

type Row = {
  productId: string;
  userId?: string | null;
  guestId?: string | null;
  quantity: number;
};

const cartRows: Row[] = [];
const wishRows: Array<{
  productId: string;
  userId?: string | null;
  guestId?: string | null;
}> = [];
let stock = 3;

const ofOwner = (
  row: { userId?: string | null; guestId?: string | null },
  where: {
    userId?: string;
    guestId?: string;
  },
): boolean =>
  where.userId !== undefined
    ? row.userId === where.userId
    : row.guestId === where.guestId;

const mock = prisma as unknown as {
  product: { findMany: jest.Mock; findUnique: jest.Mock };
  cartItem: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
    upsert: jest.Mock;
  };
  wishlistItem: { findUnique: jest.Mock; findMany: jest.Mock };
  $transaction: jest.Mock;
};

const keyOf = (
  where: Record<
    string,
    { productId: string; userId?: string; guestId?: string }
  >,
) => Object.values(where)[0];

beforeEach(() => {
  jest.clearAllMocks();
  cartRows.length = 0;
  wishRows.length = 0;
  stock = 3;

  mock.product.findUnique.mockImplementation(async () => ({ quantity: stock }));
  mock.product.findMany.mockImplementation(
    async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({
        id,
        name: `name-${id}`,
        price: 100,
        previewImage: null,
        quantity: stock,
      })),
  );

  mock.cartItem.findMany.mockImplementation(
    async ({ where }: { where: Record<string, unknown> }) =>
      cartRows
        .filter((row) => ofOwner(row, where))
        .map((row) => ({ productId: row.productId, quantity: row.quantity })),
  );
  mock.wishlistItem.findMany.mockImplementation(
    async ({ where }: { where: Record<string, unknown> }) =>
      wishRows
        .filter((row) => ofOwner(row, where))
        .map((row) => ({ productId: row.productId })),
  );
  mock.cartItem.deleteMany.mockImplementation(
    async ({
      where,
    }: {
      where: { productId: string; userId?: string; guestId?: string };
    }) => {
      const before = cartRows.length;

      for (let index = cartRows.length - 1; index >= 0; index -= 1) {
        const row = cartRows[index];

        if (row.productId === where.productId && ofOwner(row, where)) {
          cartRows.splice(index, 1);
        }
      }

      return { count: before - cartRows.length };
    },
  );
  mock.cartItem.findUnique.mockImplementation(
    async ({ where }: { where: Record<string, { productId: string }> }) => {
      const { productId } = keyOf(where as never);
      const ownerWhere = Object.values(where)[0] as never as {
        userId?: string;
        guestId?: string;
      };

      return (
        cartRows.find(
          (row) => row.productId === productId && ofOwner(row, ownerWhere),
        ) ?? null
      );
    },
  );
  mock.cartItem.upsert.mockImplementation(
    async ({
      where,
      create,
      update,
    }: {
      where: Record<
        string,
        { productId: string; userId?: string; guestId?: string }
      >;
      create: Row;
      update: { quantity: number };
    }) => {
      const ownerWhere = Object.values(where)[0] as {
        userId?: string;
        guestId?: string;
      };
      const { productId } = Object.values(where)[0];
      const existing = cartRows.find(
        (row) => row.productId === productId && ofOwner(row, ownerWhere),
      );

      if (existing) {
        existing.quantity = update.quantity;
        return { id: "row", productId, quantity: existing.quantity };
      }

      cartRows.push({ ...create });
      return { id: "row", productId, quantity: create.quantity };
    },
  );
  mock.cartItem.update.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: Record<string, { productId: string }>;
      data: { quantity: number };
    }) => {
      const ownerWhere = Object.values(where)[0] as never as {
        userId?: string;
        guestId?: string;
      };
      const { productId } = Object.values(where)[0];
      const row = cartRows.find(
        (line) => line.productId === productId && ofOwner(line, ownerWhere),
      );

      if (!row) {
        throw new Error("not found");
      }

      row.quantity = data.quantity;

      return { id: "row", productId, quantity: row.quantity };
    },
  );
  mock.cartItem.delete.mockImplementation(
    async ({ where }: { where: Record<string, { productId: string }> }) => {
      const ownerWhere = Object.values(where)[0] as never as {
        userId?: string;
        guestId?: string;
      };
      const { productId } = Object.values(where)[0];
      const index = cartRows.findIndex(
        (row) => row.productId === productId && ofOwner(row, ownerWhere),
      );

      if (index < 0) {
        throw new Error("not found");
      }

      return cartRows.splice(index, 1)[0];
    },
  );

  mock.wishlistItem.findMany.mockImplementation(
    async ({ where }: { where: Record<string, unknown> }) =>
      wishRows
        .filter((row) => ofOwner(row, where))
        .map((row) => ({ productId: row.productId })),
  );
  mock.wishlistItem.findUnique.mockImplementation(
    async ({ where }: { where: Record<string, { productId: string }> }) => {
      const ownerWhere = Object.values(where)[0] as never as {
        userId?: string;
        guestId?: string;
      };
      const { productId } = Object.values(where)[0];

      return (
        wishRows.find(
          (row) => row.productId === productId && ofOwner(row, ownerWhere),
        ) ?? null
      );
    },
  );

  mock.$transaction.mockImplementation(
    async (callback: (client: typeof prisma) => Promise<unknown>) =>
      callback(prisma),
  );
});

describe("CartService with two kinds of owner", () => {
  it("answers an empty cart to a reader with no identity, without a query (AC-6)", async () => {
    await expect(new CartService().getCart(null)).resolves.toEqual([]);
    expect(mock.cartItem.findMany).not.toHaveBeenCalled();
  });

  it("reads only the guest rows for a guest owner (AC-4, AC-8)", async () => {
    cartRows.push({ productId: "p1", guestId: "guest-1", quantity: 1 });
    cartRows.push({ productId: "p2", userId: "user-1", quantity: 2 });

    const cart = await new CartService().getCart(guestOwner("guest-1"));

    expect(cart.map((line) => line.id)).toEqual(["p1"]);
    expect(cart[0].quantityInCart).toBe(1);
    expect(mock.cartItem.findMany).toHaveBeenCalledWith({
      where: { guestId: "guest-1" },
      select: { productId: true, quantity: true },
    });
  });

  it("raises the quantity on a repeated add instead of failing (AC-10)", async () => {
    const service = new CartService();

    const first = await service.addProductToCart(guestOwner("guest-1"), {
      productId: "p1",
    });
    const second = await service.addProductToCart(guestOwner("guest-1"), {
      productId: "p1",
    });

    expect(first.quantityInCart).toBe(1);
    expect(second.quantityInCart).toBe(2);
    expect(cartRows).toEqual([
      { productId: "p1", guestId: "guest-1", quantity: 2 },
    ]);
  });

  it("caps the quantity at the stock (AC-10)", async () => {
    stock = 1;
    const service = new CartService();

    await service.addProductToCart(guestOwner("guest-1"), { productId: "p1" });
    const second = await service.addProductToCart(guestOwner("guest-1"), {
      productId: "p1",
    });

    expect(second.quantityInCart).toBe(1);
    expect(cartRows[0].quantity).toBe(1);
  });

  it("marks the delete with the real wishlist state (AC-8)", async () => {
    cartRows.push({ productId: "p1", guestId: "guest-1", quantity: 1 });
    wishRows.push({ productId: "p1", guestId: "guest-1" });

    const marked = await new CartService().deleteProductFromCart(
      guestOwner("guest-1"),
      "p1",
    );

    expect(marked).toEqual({ isWishlisted: true, quantityInCart: 0 });
    expect(cartRows).toHaveLength(0);
  });

  it("answers an unmarked delete when the product is not on the wishlist (AC-8)", async () => {
    cartRows.push({ productId: "p1", guestId: "guest-1", quantity: 1 });

    const marked = await new CartService().deleteProductFromCart(
      guestOwner("guest-1"),
      "p1",
    );

    expect(marked).toEqual({ isWishlisted: false, quantityInCart: 0 });
  });

  it("never addresses an account row for a guest, or a guest row for an account (AC-12)", async () => {
    cartRows.push({ productId: "p1", userId: "user-1", quantity: 2 });
    cartRows.push({ productId: "p2", guestId: "guest-1", quantity: 1 });

    await new CartService().addProductToCart(userOwner("user-1"), {
      productId: "p1",
    });

    expect(cartRows.find((row) => row.productId === "p1")?.quantity).toBe(3);
    expect(cartRows.find((row) => row.productId === "p2")?.quantity).toBe(1);
  });
});
