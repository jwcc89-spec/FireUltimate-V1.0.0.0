-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentNumber" TEXT,
    "dispatchNumber" TEXT,
    "incidentType" TEXT NOT NULL DEFAULT '',
    "priority" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "stillDistrict" TEXT NOT NULL DEFAULT '',
    "assignedUnits" TEXT NOT NULL DEFAULT '',
    "reportedBy" TEXT,
    "callbackNumber" TEXT,
    "dispatchNotes" TEXT,
    "currentState" TEXT NOT NULL DEFAULT 'Draft',
    "receivedAt" TEXT NOT NULL DEFAULT '',
    "dispatchInfo" TEXT NOT NULL DEFAULT '',
    "apparatusJson" JSONB,
    "mapReference" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Incident_tenantId_idx" ON "Incident"("tenantId");

-- CreateIndex
CREATE INDEX "Incident_tenantId_deletedAt_idx" ON "Incident"("tenantId", "deletedAt");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
