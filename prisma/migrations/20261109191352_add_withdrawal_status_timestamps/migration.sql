-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "processingAt" TIMESTAMP(3);
