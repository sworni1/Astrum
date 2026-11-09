-- Add the shop name in three steps so existing rows keep their data.
ALTER TABLE "Business" ADD COLUMN "name" TEXT;

UPDATE "Business"
SET "name" = 'Shop ' || RIGHT("id", 6)
WHERE "name" IS NULL;

ALTER TABLE "Business" ALTER COLUMN "name" SET NOT NULL;
