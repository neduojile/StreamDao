-- CreateTable
CREATE TABLE "CouponBatch" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "totalCodes" INTEGER NOT NULL,
    "createdByAdminId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalCoupon" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "redeemedByUserId" TEXT,
    "redeemedWithdrawalId" TEXT,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "customerServiceUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CouponSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CouponBatch_createdAt_idx" ON "CouponBatch"("createdAt");

-- CreateIndex
CREATE INDEX "CouponBatch_expiresAt_idx" ON "CouponBatch"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalCoupon_codeHash_key" ON "WithdrawalCoupon"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalCoupon_redeemedWithdrawalId_key" ON "WithdrawalCoupon"("redeemedWithdrawalId");

-- CreateIndex
CREATE INDEX "WithdrawalCoupon_batchId_status_idx" ON "WithdrawalCoupon"("batchId", "status");

-- CreateIndex
CREATE INDEX "WithdrawalCoupon_status_expiresAt_idx" ON "WithdrawalCoupon"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "WithdrawalCoupon_redeemedByUserId_idx" ON "WithdrawalCoupon"("redeemedByUserId");

-- AddForeignKey
ALTER TABLE "WithdrawalCoupon" ADD CONSTRAINT "WithdrawalCoupon_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CouponBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
