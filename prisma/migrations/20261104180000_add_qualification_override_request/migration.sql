-- CreateTable
CREATE TABLE "QualificationOverrideRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requesterUsername" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "shiftType" TEXT NOT NULL DEFAULT '',
    "apparatus" TEXT NOT NULL DEFAULT '',
    "unitId" TEXT NOT NULL DEFAULT '',
    "slotIndex" INTEGER NOT NULL DEFAULT 0,
    "dateKey" TEXT NOT NULL,
    "requiredQualification" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "denialReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualificationOverrideRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QualificationOverrideRequest_tenantId_status_idx" ON "QualificationOverrideRequest"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "QualificationOverrideRequest" ADD CONSTRAINT "QualificationOverrideRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
