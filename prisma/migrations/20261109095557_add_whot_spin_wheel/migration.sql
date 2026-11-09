-- CreateTable
CREATE TABLE "WhotSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailySpinLimit" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhotSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhotPrize" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "probability" DECIMAL(8,4) NOT NULL,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhotPrize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhotSpin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prizeId" TEXT,
    "dayKey" TEXT NOT NULL,
    "spinNumber" INTEGER NOT NULL,
    "prizeLabel" TEXT NOT NULL,
    "reward" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhotSpin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhotPrize_settingsId_sortOrder_idx" ON "WhotPrize"("settingsId", "sortOrder");

-- CreateIndex
CREATE INDEX "WhotSpin_userId_createdAt_idx" ON "WhotSpin"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WhotSpin_dayKey_idx" ON "WhotSpin"("dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "WhotSpin_userId_dayKey_spinNumber_key" ON "WhotSpin"("userId", "dayKey", "spinNumber");

-- AddForeignKey
ALTER TABLE "WhotPrize" ADD CONSTRAINT "WhotPrize_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "WhotSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhotSpin" ADD CONSTRAINT "WhotSpin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhotSpin" ADD CONSTRAINT "WhotSpin_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "WhotPrize"("id") ON DELETE SET NULL ON UPDATE CASCADE;
