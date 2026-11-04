-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "idempotencyHash" VARCHAR(64),
ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_userId_idempotencyKey_key" ON "Order"("userId", "idempotencyKey");

