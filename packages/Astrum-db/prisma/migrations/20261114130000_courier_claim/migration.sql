-- AlterTable
ALTER TABLE "Order" ADD COLUMN "courierUserId" TEXT;

-- CreateIndex
CREATE INDEX "Order_courierUserId_idx" ON "Order"("courierUserId");
