-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "handedOverAt" TIMESTAMP(3),
ADD COLUMN     "pickupPointAddress" TEXT,
ADD COLUMN     "pickupPointId" TEXT,
ADD COLUMN     "pickupPointName" TEXT,
ALTER COLUMN "deliveryAddress" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ShippingMethod" ADD COLUMN     "isPickup" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PickupPoint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PickupPoint_name_key" ON "PickupPoint"("name");

-- CreateIndex
CREATE INDEX "Order_pickupPointId_idx" ON "Order"("pickupPointId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pickupPointId_fkey" FOREIGN KEY ("pickupPointId") REFERENCES "PickupPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the pickup delivery method. The name is the key: a database that already
-- holds a row with this name keeps its id and takes the price and the flag.
INSERT INTO "ShippingMethod" ("id", "name", "price", "currency", "isActive", "isPickup")
VALUES (
  'sm_' || replace(gen_random_uuid()::text, '-', ''),
  'Pickup at the shop',
  0.00,
  'RUB',
  true,
  true
)
ON CONFLICT ("name") DO UPDATE SET
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  "isPickup" = true,
  "isActive" = true;
