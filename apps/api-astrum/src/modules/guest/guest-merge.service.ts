import { prisma } from "../../../lib/prisma";

export type MergeCounts = { cartLines: number; wishlistLines: number };

const LIVE_PRODUCT_SELECT = {
  isDeleted: true,
  visibility: true,
  status: true,
} as const;

const isLive = (product: {
  isDeleted: boolean;
  visibility: string;
  status: string;
}): boolean =>
  !product.isDeleted &&
  product.visibility === "Public" &&
  product.status === "Published";

export class GuestMergeService {
  async merge(userId: string, guestId: string | null): Promise<MergeCounts> {
    if (!guestId) {
      return { cartLines: 0, wishlistLines: 0 };
    }

    return await prisma.$transaction(async (tx) => {
      let cartLines = 0;
      let wishlistLines = 0;

      const guestCart = await tx.cartItem.findMany({ where: { guestId } });

      for (const line of guestCart) {
        const product = await tx.product.findUnique({
          where: { id: line.productId },
          select: { quantity: true, ...LIVE_PRODUCT_SELECT },
        });

        if (!product || !isLive(product) || product.quantity <= 0) {
          continue;
        }

        const accountLine = await tx.cartItem.findUnique({
          where: {
            userId_productId: { userId, productId: line.productId },
          },
        });

        const quantity = Math.min(
          (accountLine?.quantity ?? 0) + line.quantity,
          product.quantity,
        );

        await tx.cartItem.upsert({
          where: { userId_productId: { userId, productId: line.productId } },
          create: { userId, productId: line.productId, quantity },
          update: { quantity },
        });

        cartLines += 1;
      }

      const guestWishlist = await tx.wishlistItem.findMany({
        where: { guestId },
      });

      for (const line of guestWishlist) {
        const product = await tx.product.findUnique({
          where: { id: line.productId },
          select: LIVE_PRODUCT_SELECT,
        });

        if (!product || !isLive(product)) {
          continue;
        }

        const accountLine = await tx.wishlistItem.findUnique({
          where: {
            userId_productId: { userId, productId: line.productId },
          },
        });

        if (accountLine) {
          continue;
        }

        await tx.wishlistItem.create({
          data: { userId, productId: line.productId },
        });

        wishlistLines += 1;
      }

      await tx.cartItem.deleteMany({ where: { guestId } });
      await tx.wishlistItem.deleteMany({ where: { guestId } });

      return { cartLines, wishlistLines };
    });
  }
}
