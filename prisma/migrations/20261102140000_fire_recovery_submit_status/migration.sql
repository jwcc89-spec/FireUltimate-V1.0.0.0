-- AlterTable
ALTER TABLE "FireRecoveryIncidentBilling" ADD COLUMN "submitStatus" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "FireRecoveryIncidentBilling" ADD COLUMN "submitStartedAt" TIMESTAMP(3);
