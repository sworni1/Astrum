DO $$
DECLARE
  missing_product_count bigint;
  unsupported_status_count bigint;
BEGIN
  SELECT COUNT(*) INTO missing_product_count
  FROM "OrderItem" oi
  LEFT JOIN "Product" p ON p.id = oi."productId"
  WHERE p.id IS NULL;

  SELECT COUNT(*) INTO unsupported_status_count
  FROM "OrderItem"
  WHERE status IN ('RETURNED', 'BACKORDERED', 'REPLACED');

  IF missing_product_count > 0 OR unsupported_status_count > 0 THEN
    RAISE EXCEPTION
      'Business ownership migration stopped: order lines without products %, unsupported order line statuses %',
      missing_product_count,
      unsupported_status_count;
  END IF;
END $$;

CREATE TABLE "Business" (
  id TEXT NOT NULL,
  "ownerUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Business_pkey" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX "Business_ownerUserId_key" ON "Business"("ownerUserId");

ALTER TABLE "OrderItem" ADD COLUMN "businessId" TEXT;

INSERT INTO "Business" (id)
SELECT DISTINCT "businessId"
FROM "Product"
ON CONFLICT (id) DO NOTHING;

UPDATE "OrderItem" oi
SET "businessId" = p."businessId"
FROM "Product" p
WHERE p.id = oi."productId";
