-- CreateTable
CREATE TABLE "TappingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taps" INTEGER NOT NULL DEFAULT 0,
    "lastClaimedAt" TIMESTAMP(3),
    "lastTapAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TappingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TappingProgress_userId_key" ON "TappingProgress"("userId");

-- CreateIndex
CREATE INDEX "TappingProgress_lastClaimedAt_idx" ON "TappingProgress"("lastClaimedAt");

-- AddForeignKey
ALTER TABLE "TappingProgress" ADD CONSTRAINT "TappingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
