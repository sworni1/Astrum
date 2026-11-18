-- A cart and a wishlist line belong to an account or to a guest, never to both
-- and never to nobody (spec 0028, AC-1). Prisma cannot express the check.
ALTER TABLE "CartItem" ADD COLUMN     "guestId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "WishlistItem" ADD COLUMN     "guestId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "userId" DROP NOT NULL;

CREATE INDEX "CartItem_guestId_idx" ON "CartItem"("guestId");
CREATE UNIQUE INDEX "CartItem_guestId_productId_key" ON "CartItem"("guestId", "productId");
CREATE INDEX "WishlistItem_guestId_idx" ON "WishlistItem"("guestId");
CREATE UNIQUE INDEX "WishlistItem_guestId_productId_key" ON "WishlistItem"("guestId", "productId");

ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_owner_exactly_one"
  CHECK ((("userId" IS NOT NULL) <> ("guestId" IS NOT NULL)));
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_owner_exactly_one"
  CHECK ((("userId" IS NOT NULL) <> ("guestId" IS NOT NULL)));
