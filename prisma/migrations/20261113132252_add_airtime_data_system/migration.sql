-- CreateTable
CREATE TABLE "AirtimeSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "airtimeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dataEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mtnEnabled" BOOLEAN NOT NULL DEFAULT true,
    "airtelEnabled" BOOLEAN NOT NULL DEFAULT true,
    "gloEnabled" BOOLEAN NOT NULL DEFAULT true,
    "nineMobileEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minimumAmountNgn" DECIMAL(18,2) NOT NULL DEFAULT 50,
    "maximumAmountNgn" DECIMAL(18,2) NOT NULL DEFAULT 50000,
    "markupPercent" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "minimumDataAmountNgn" DECIMAL(18,2) NOT NULL DEFAULT 50,
    "maximumDataAmountNgn" DECIMAL(18,2) NOT NULL DEFAULT 50000,
    "exchangeRateSource" TEXT NOT NULL DEFAULT 'EXCHANGE_RATE_API',
    "exchangeRateOverride" DECIMAL(18,6),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AirtimeSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirtimePlan" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountNgn" DECIMAL(18,2) NOT NULL,
    "validity" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AirtimePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirtimeOrder" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "providerReference" TEXT,
    "userId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "amountNgn" DECIMAL(18,2) NOT NULL,
    "markupNgn" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "exchangeRate" DECIMAL(18,6) NOT NULL,
    "amountEur" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerStatus" TEXT,
    "providerResponse" JSONB,
    "failureReason" TEXT,
    "walletDebitedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AirtimeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirtimeGiveaway" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'AIRTIME',
    "network" TEXT NOT NULL,
    "serviceId" TEXT,
    "planName" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "amountNgn" DECIMAL(18,2) NOT NULL,
    "providerReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerResponse" JSONB,
    "failureReason" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AirtimeGiveaway_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AirtimePlan_serviceId_key" ON "AirtimePlan"("serviceId");

-- CreateIndex
CREATE INDEX "AirtimePlan_network_type_isActive_idx" ON "AirtimePlan"("network", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AirtimeOrder_reference_key" ON "AirtimeOrder"("reference");

-- CreateIndex
CREATE INDEX "AirtimeOrder_userId_createdAt_idx" ON "AirtimeOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AirtimeOrder_status_createdAt_idx" ON "AirtimeOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AirtimeOrder_providerReference_idx" ON "AirtimeOrder"("providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "AirtimeGiveaway_reference_key" ON "AirtimeGiveaway"("reference");

-- CreateIndex
CREATE INDEX "AirtimeGiveaway_userId_createdAt_idx" ON "AirtimeGiveaway"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AirtimeGiveaway_status_createdAt_idx" ON "AirtimeGiveaway"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "AirtimeOrder" ADD CONSTRAINT "AirtimeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AirtimeGiveaway" ADD CONSTRAINT "AirtimeGiveaway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
