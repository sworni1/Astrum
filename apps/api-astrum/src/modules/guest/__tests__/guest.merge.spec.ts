jest.mock("../../../../lib/prisma", () => ({
  prisma: { $transaction: jest.fn() },
}));

import { prisma } from "../../../../lib/prisma";
import { GuestMergeService } from "../guest-merge.service";

type CartRow = { id: string; guestId: string; productId: string; quantity: number };
type WishRow = { id: string; guestId: string; productId: string };
type ProductRow = {
  id: string;
  quantity: number;
  isDeleted: boolean;
  visibility: string;
  status: string;
};

type Tx = {
  cartItem: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    upsert: jest.Mock;
    deleteMany: jest.Mock;
  };
  wishlistItem: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    deleteMany: jest.Mock;
  };
  product: { findUnique: jest.Mock };
};

const product = (overrides: Partial<ProductRow> = {}): ProductRow => ({
  id: "product-1",
  quantity: 10,
  isDeleted: false,
  visibility: "Public",
  status: "Published",
  ...overrides,
});

const buildTx = (state: {
  cart: CartRow[];
  wishlist: WishRow[];
  accountCart: Array<{ productId: string; quantity: number }>;
  accountWishlist: string[];
  products: Map<string, ProductRow>;
}): Tx => {
  const cart = [...state.cart];
  const wishlist = [...state.wishlist];
  const accountCart = [...state.accountCart];
  const accountWishlist = new Set(state.accountWishlist);

  return {
    cartItem: {
      findMany: jest.fn(async () => cart.filter((row) => row.guestId === "guest-1")),
      findUnique: jest.fn(async ({ where }: { where: { userId_productId: { productId: string } } }) => {
        const hit = accountCart.find(
          (row) => row.productId === where.userId_productId.productId,
        );

        return hit ? { ...hit } : null;
      }),
      upsert: jest.fn(async ({ where, create, update }: {
        where: { userId_productId: { productId: string } };
        create: { productId: string; quantity: number };
        update: { quantity: number };
      }) => {
        const productId = where.userId_productId.productId;
        const existing = accountCart.find((row) => row.productId === productId);

        if (existing) {
          existing.quantity = update.quantity;
          return { ...existing };
        }

        accountCart.push({ productId: create.productId, quantity: create.quantity });
        return { ...create };
      }),
      deleteMany: jest.fn(async () => ({ count: cart.length })),
    },
    wishlistItem: {
      findMany: jest.fn(async () => wishlist.filter((row) => row.guestId === "guest-1")),
      findUnique: jest.fn(async ({ where }: { where: { userId_productId: { productId: string } } }) =>
        accountWishlist.has(where.userId_productId.productId) ? { id: "w-1" } : null,
      ),
      create: jest.fn(async ({ data }: { data: { productId: string } }) => {
        accountWishlist.add(data.productId);
        return { id: "created" };
      }),
      deleteMany: jest.fn(async () => ({ count: wishlist.length })),
    },
    product: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        state.products.get(where.id) ?? null,
      ),
    },
  };
};

const wire = (tx: Tx): Tx => {
  (prisma as unknown as { $transaction: jest.Mock }).$transaction.mockImplementation(
    async (callback: (client: Tx) => Promise<unknown>) => callback(tx),
  );

  return tx;
};

describe("GuestMergeService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("moves the guest lines into the account, capped at the stock (AC-11)", async () => {
    const tx = wire(
      buildTx({
        cart: [
          { id: "c1", guestId: "guest-1", productId: "product-1", quantity: 3 },
          { id: "c2", guestId: "guest-1", productId: "product-2", quantity: 5 },
        ],
        wishlist: [
          { id: "w1", guestId: "guest-1", productId: "product-1" },
          { id: "w2", guestId: "guest-1", productId: "product-2" },
        ],
        accountCart: [{ productId: "product-1", quantity: 2 }],
        accountWishlist: ["product-2"],
        products: new Map([
          ["product-1", product({ id: "product-1", quantity: 4 })],
          ["product-2", product({ id: "product-2", quantity: 10 })],
        ]),
      }),
    );

    const counts = await new GuestMergeService().merge("user-1", "guest-1");

    expect(tx.cartItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: "user-1", productId: "product-1", quantity: 4 },
        update: { quantity: 4 },
      }),
    );
    expect(tx.cartItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { quantity: 5 } }),
    );

    expect(counts).toEqual({ cartLines: 2, wishlistLines: 1 });
    expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({ where: { guestId: "guest-1" } });
    expect(tx.wishlistItem.deleteMany).toHaveBeenCalledWith({ where: { guestId: "guest-1" } });
  });

  it("drops a gone product and a product with no stock, and still clears the guest rows (AC-9)", async () => {
    const tx = wire(
      buildTx({
        cart: [
          { id: "c1", guestId: "guest-1", productId: "gone", quantity: 1 },
          { id: "c2", guestId: "guest-1", productId: "empty", quantity: 2 },
        ],
        wishlist: [{ id: "w1", guestId: "guest-1", productId: "gone" }],
        accountCart: [{ productId: "empty", quantity: 2 }],
        accountWishlist: [],
        products: new Map([
          ["gone", product({ id: "gone", isDeleted: true })],
          ["empty", product({ id: "empty", quantity: 0 })],
        ]),
      }),
    );

    const counts = await new GuestMergeService().merge("user-1", "guest-1");

    expect(tx.cartItem.upsert).not.toHaveBeenCalled();
    expect(tx.wishlistItem.create).not.toHaveBeenCalled();
    expect(counts).toEqual({ cartLines: 0, wishlistLines: 0 });
    expect(tx.cartItem.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.wishlistItem.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("answers zeros when the request carries no guest cookie", async () => {
    const counts = await new GuestMergeService().merge("user-1", null);

    expect(counts).toEqual({ cartLines: 0, wishlistLines: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("leaves everything untouched when the transaction throws (AC-11)", async () => {
    (prisma as unknown as { $transaction: jest.Mock }).$transaction.mockRejectedValue(
      new Error("deadlock"),
    );

    await expect(
      new GuestMergeService().merge("user-1", "guest-1"),
    ).rejects.toThrow("deadlock");
  });

  it("counts nothing on a second call, because the guest rows are gone (AC-11)", async () => {
    const tx = wire(
      buildTx({
        cart: [],
        wishlist: [],
        accountCart: [],
        accountWishlist: [],
        products: new Map(),
      }),
    );

    const counts = await new GuestMergeService().merge("user-1", "guest-1");

    expect(counts).toEqual({ cartLines: 0, wishlistLines: 0 });
    expect(tx.cartItem.upsert).not.toHaveBeenCalled();
  });
});
