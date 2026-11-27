-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'SELLER', 'POINT_WORKER', 'COURIER', 'OWNER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "roles" "UserRole"[] DEFAULT ARRAY['CUSTOMER']::"UserRole"[];

-- BackfillDerivedRoles
UPDATE "User" u
SET "roles" = array_append(u."roles", 'SELLER'::"UserRole")
WHERE EXISTS (
    SELECT 1 FROM "Business" b WHERE b."ownerUserId" = u."id"
);

UPDATE "User" u
SET "roles" = array_append(u."roles", 'POINT_WORKER'::"UserRole")
WHERE EXISTS (
    SELECT 1 FROM "PointWorker" w WHERE w."userId" = u."id"
);

UPDATE "User" u
SET "roles" = array_append(u."roles", 'COURIER'::"UserRole")
WHERE EXISTS (
    SELECT 1 FROM "Courier" c WHERE c."userId" = u."id"
);
