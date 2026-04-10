-- Fire Recovery USA: tenant fields + per-incident billing rows
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "fireRecoverySubscriptionKey" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "fireRecoveryDepartmentName" TEXT;

CREATE TABLE IF NOT EXISTS "FireRecoveryIncidentBilling" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "callNumber" TEXT NOT NULL,
    "trackingId" TEXT,
    "lastSubmitAt" TIMESTAMP(3),
    "lastSubmitOk" BOOLEAN NOT NULL DEFAULT false,
    "lastSubmitError" TEXT NOT NULL DEFAULT '',
    "incidentType" TEXT NOT NULL DEFAULT '',
    "incidentDateLabel" TEXT NOT NULL DEFAULT '',
    "invoiceId" TEXT NOT NULL DEFAULT '',
    "invoiceAmount" TEXT NOT NULL DEFAULT '',
    "invoiceAmountDue" TEXT NOT NULL DEFAULT '',
    "invoiceSubmitDate" TEXT NOT NULL DEFAULT '',
    "invoiceStatus" TEXT NOT NULL DEFAULT '',
    "lastPaymentDate" TEXT NOT NULL DEFAULT '',
    "lastPaymentAmount" TEXT NOT NULL DEFAULT '',
    "paymentPlan" BOOLEAN NOT NULL DEFAULT false,
    "billingFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FireRecoveryIncidentBilling_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FireRecoveryIncidentBilling_tenantId_callNumber_key" ON "FireRecoveryIncidentBilling"("tenantId", "callNumber");
CREATE INDEX IF NOT EXISTS "FireRecoveryIncidentBilling_tenantId_idx" ON "FireRecoveryIncidentBilling"("tenantId");
CREATE INDEX IF NOT EXISTS "FireRecoveryIncidentBilling_tenantId_updatedAt_idx" ON "FireRecoveryIncidentBilling"("tenantId", "updatedAt");

ALTER TABLE "FireRecoveryIncidentBilling" ADD CONSTRAINT "FireRecoveryIncidentBilling_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
