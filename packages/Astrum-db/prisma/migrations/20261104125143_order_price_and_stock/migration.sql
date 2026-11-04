-- Order money becomes exact decimals and gains its currency.
-- The currency columns are added nullable, backfilled from the ordered products,
-- then made required, so an existing row never guesses a currency.
-- AlterTable: money to numeric(10,2)
ALTER TABLE "Order" ALTER COLUMN "totalPrice" SET DATA TYPE DECIMAL(10,2);
ALTER TABLE "OrderItem" ALTER COLUMN "price" SET DATA TYPE DECIMAL(10,2);

-- AlterTable: currency arrives nullable first
ALTER TABLE "Order" ADD COLUMN "currency" "Currency";
ALTER TABLE "OrderItem" ADD COLUMN "currency" "Currency";

-- Backfill: every line takes the currency of the product it points at
UPDATE "OrderItem" AS oi
SET "currency" = p."currency"
FROM "Product" AS p
WHERE p."id" = oi."productId";

-- Backfill: every order takes the currency of its first line
UPDATE "Order" AS o
SET "currency" = oi."currency"
FROM (
  SELECT DISTINCT ON ("orderId") "orderId", "currency"
  FROM "OrderItem"
  ORDER BY "orderId", "id"
) AS oi
WHERE oi."orderId" = o."id";

-- A line or an order that could not be resolved aborts the migration instead of
-- writing a currency nobody chose.
DO $$
DECLARE
  lines_without_currency integer;
  orders_without_currency integer;
BEGIN
  SELECT count(*) INTO lines_without_currency FROM "OrderItem" WHERE "currency" IS NULL;
  SELECT count(*) INTO orders_without_currency FROM "Order" WHERE "currency" IS NULL;

  IF lines_without_currency > 0 THEN
    RAISE EXCEPTION 'Cannot backfill OrderItem.currency: % line(s) point at a missing product', lines_without_currency;
  END IF;

  IF orders_without_currency > 0 THEN
    RAISE EXCEPTION 'Cannot backfill Order.currency: % order(s) have no line to copy from', orders_without_currency;
  END IF;
END $$;

-- AlterTable: currency becomes required
ALTER TABLE "Order" ALTER COLUMN "currency" SET NOT NULL;
ALTER TABLE "OrderItem" ALTER COLUMN "currency" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
