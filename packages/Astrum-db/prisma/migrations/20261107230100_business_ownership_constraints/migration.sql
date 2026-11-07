DO $$
DECLARE
  missing_product_count bigint;
  missing_snapshot_count bigint;
  missing_business_count bigint;
  unsupported_status_count bigint;
BEGIN
  SELECT COUNT(*) INTO missing_product_count
  FROM "OrderItem" oi
  LEFT JOIN "Product" p ON p.id = oi."productId"
  WHERE p.id IS NULL;

  SELECT COUNT(*) INTO missing_snapshot_count
  FROM "OrderItem"
  WHERE "businessId" IS NULL;

  SELECT COUNT(*) INTO missing_business_count
  FROM (
    SELECT p."businessId" AS business_id
    FROM "Product" p
    LEFT JOIN "Business" b ON b.id = p."businessId"
    WHERE b.id IS NULL
    UNION ALL
    SELECT oi."businessId" AS business_id
    FROM "OrderItem" oi
    LEFT JOIN "Business" b ON b.id = oi."businessId"
    WHERE oi."businessId" IS NOT NULL AND b.id IS NULL
  ) missing;

  SELECT COUNT(*) INTO unsupported_status_count
  FROM "OrderItem"
  WHERE status IN ('RETURNED', 'BACKORDERED', 'REPLACED');

  IF missing_product_count > 0
    OR missing_snapshot_count > 0
    OR missing_business_count > 0
    OR unsupported_status_count > 0 THEN
    RAISE EXCEPTION
      'Business ownership constraints stopped: order lines without products %, missing business snapshots %, missing businesses %, unsupported order line statuses %',
      missing_product_count,
      missing_snapshot_count,
      missing_business_count,
      unsupported_status_count;
  END IF;
END $$;

ALTER TABLE "OrderItem" ALTER COLUMN "businessId" SET NOT NULL;

CREATE INDEX "Product_businessId_idx" ON "Product"("businessId");
CREATE INDEX "OrderItem_businessId_orderId_idx" ON "OrderItem"("businessId", "orderId");

ALTER TABLE "Business"
  ADD CONSTRAINT "Business_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;
