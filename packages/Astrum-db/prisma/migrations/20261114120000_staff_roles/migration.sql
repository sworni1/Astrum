-- CreateTable
CREATE TABLE "PointWorker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pickupPointId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointWorker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Courier" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Courier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PointWorker_userId_key" ON "PointWorker"("userId");

-- CreateIndex
CREATE INDEX "PointWorker_pickupPointId_idx" ON "PointWorker"("pickupPointId");

-- CreateIndex
CREATE UNIQUE INDEX "Courier_userId_key" ON "Courier"("userId");

-- AddForeignKey
ALTER TABLE "PointWorker" ADD CONSTRAINT "PointWorker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointWorker" ADD CONSTRAINT "PointWorker_pickupPointId_fkey" FOREIGN KEY ("pickupPointId") REFERENCES "PickupPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courier" ADD CONSTRAINT "Courier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
