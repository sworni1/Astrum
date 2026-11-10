-- Spec 0009: the delivery method becomes data and every order keeps the
-- delivery amount it was placed with.

-- 1. ShippingMethod: money as a decimal, plus a currency and an on and off switch.
ALTER TABLE "ShippingMethod"
  ALTER COLUMN "price" TYPE numeric(10, 2) USING round("price"::numeric, 2);

ALTER TABLE "ShippingMethod" ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'RUB';
ALTER TABLE "ShippingMethod" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- 2. Order: the three snapshot columns start nullable.
ALTER TABLE "Order" ADD COLUMN "shippingMethodName" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryPrice" numeric(10, 2);
ALTER TABLE "Order" ADD COLUMN "grandTotal" numeric(10, 2);

-- 3. Backfill before the requote, so every existing order keeps the delivery
--    amount that was in force when it was placed.
UPDATE "Order" o
SET "shippingMethodName" = s."name",
    "deliveryPrice" = round(s."price", 2),
    "grandTotal" = o."totalPrice" + round(s."price", 2)
FROM "ShippingMethod" s
WHERE s."id" = o."shippingMethodId";

-- 4. Required once every row carries its snapshot.
ALTER TABLE "Order" ALTER COLUMN "shippingMethodName" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "deliveryPrice" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "grandTotal" SET NOT NULL;

-- 5. Every environment keeps the two standard methods. A row that already
--    carries one of the names is repriced and switched on instead of
--    duplicated, so its id survives. The id is supplied here because the
--    column has no database default (the cuid default lives in the client).
INSERT INTO "ShippingMethod" ("id", "name", "price", "currency", "isActive")
VALUES
  ('sm_' || replace(gen_random_uuid()::text, '-', ''), 'Standard Delivery', 299.00, 'RUB', true),
  ('sm_' || replace(gen_random_uuid()::text, '-', ''), 'Express Delivery', 799.00, 'RUB', true)
ON CONFLICT ("name") DO UPDATE
SET "price" = EXCLUDED."price",
    "currency" = EXCLUDED."currency",
    "isActive" = true;

-- 6. The demo method leaves the checkout without losing its history.
UPDATE "ShippingMethod" SET "isActive" = false WHERE "name" = 'Verify delivery';
