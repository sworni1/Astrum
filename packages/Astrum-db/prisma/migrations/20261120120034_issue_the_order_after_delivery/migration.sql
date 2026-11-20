-- A parcel arrives by itself and is issued at the counter, so the machine gains
-- its fifth step and the shop keeps the moment the parcel started moving
-- (spec 0031, AC-1, AC-2, AC-12).
ALTER TYPE "OrderItemStatus" ADD VALUE 'ISSUED';

ALTER TYPE "OrderStatus" ADD VALUE 'ISSUED';

ALTER TABLE "Order" ADD COLUMN     "shippedAt" TIMESTAMP(3);

-- History: a parcel that was handed over has been issued since the press moved
-- it, so every delivered line of a stamped order becomes issued and its order
-- follows the lines (27 lines in 18 orders, measured 2026-11-20).
UPDATE "OrderItem" SET status = 'ISSUED'
WHERE status = 'DELIVERED'
  AND "orderId" IN (SELECT id FROM "Order" WHERE "handedOverAt" IS NOT NULL);

UPDATE "Order" SET status = 'ISSUED' WHERE "handedOverAt" IS NOT NULL;

-- The orders already on their way keep the last write as their shipping moment,
-- so the delivery pass closes them one wait after the deploy.
UPDATE "Order" SET "shippedAt" = "updatedAt" WHERE status = 'SHIPPED';
