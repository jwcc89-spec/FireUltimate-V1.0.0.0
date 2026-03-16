-- CreateTable
CREATE TABLE "NerisExportHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "callNumber" TEXT NOT NULL DEFAULT '',
    "incidentType" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "exportedAtIso" TEXT NOT NULL DEFAULT '',
    "exportedAtLabel" TEXT NOT NULL DEFAULT '',
    "attemptStatus" TEXT NOT NULL DEFAULT 'success',
    "httpStatus" INTEGER NOT NULL DEFAULT 200,
    "httpStatusText" TEXT NOT NULL DEFAULT '',
    "statusLabel" TEXT NOT NULL DEFAULT '',
    "reportStatusAtExport" TEXT NOT NULL DEFAULT '',
    "validatorName" TEXT NOT NULL DEFAULT '',
    "reportWriterName" TEXT NOT NULL DEFAULT '',
    "submittedEntityId" TEXT NOT NULL DEFAULT '',
    "submittedDepartmentNerisId" TEXT NOT NULL DEFAULT '',
    "nerisId" TEXT NOT NULL DEFAULT '',
    "responseSummary" TEXT NOT NULL DEFAULT '',
    "responseDetail" TEXT NOT NULL DEFAULT '',
    "submittedPayloadPreview" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NerisExportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NerisExportHistory_tenantId_idx" ON "NerisExportHistory"("tenantId");

-- CreateIndex
CREATE INDEX "NerisExportHistory_tenantId_createdAt_idx" ON "NerisExportHistory"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "NerisExportHistory" ADD CONSTRAINT "NerisExportHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
