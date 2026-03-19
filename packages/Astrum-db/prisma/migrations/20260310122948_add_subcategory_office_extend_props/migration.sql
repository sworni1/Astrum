-- AlterEnum
ALTER TYPE "ProductCategory" ADD VALUE 'Office';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PropertyLabel" ADD VALUE 'Type';
ALTER TYPE "PropertyLabel" ADD VALUE 'Power';
ALTER TYPE "PropertyLabel" ADD VALUE 'Features';
ALTER TYPE "PropertyLabel" ADD VALUE 'Control';
ALTER TYPE "PropertyLabel" ADD VALUE 'NoiseLevel';
ALTER TYPE "PropertyLabel" ADD VALUE 'PowerSource';
ALTER TYPE "PropertyLabel" ADD VALUE 'Display';
ALTER TYPE "PropertyLabel" ADD VALUE 'Capacity';
ALTER TYPE "PropertyLabel" ADD VALUE 'Installation';
ALTER TYPE "PropertyLabel" ADD VALUE 'Speed';
ALTER TYPE "PropertyLabel" ADD VALUE 'Construction';
ALTER TYPE "PropertyLabel" ADD VALUE 'RAM';
ALTER TYPE "PropertyLabel" ADD VALUE 'Connectivity';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "subcategory" TEXT;
