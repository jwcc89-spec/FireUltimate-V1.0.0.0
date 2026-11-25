-- AlterTable
ALTER TABLE "PmSchedule" ADD COLUMN     "earlyWarning" DECIMAL(12,1),
ADD COLUMN     "intervalValue" DECIMAL(12,1),
ADD COLUMN     "lastServiceDate" DATE,
ADD COLUMN     "lastServiceReading" DECIMAL(12,1),
ADD COLUMN     "trackingBasis" TEXT NOT NULL DEFAULT 'date';

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "vendorId" TEXT,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "storageLocation" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "recordId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PartTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectKind" TEXT NOT NULL DEFAULT 'apparatus',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplateVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "itemsJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ChecklistTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistSubmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submissionNumber" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "subjectKind" TEXT NOT NULL DEFAULT 'apparatus',
    "subjectRef" TEXT NOT NULL DEFAULT '',
    "completedOn" DATE NOT NULL,
    "completedByName" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "repairCount" INTEGER NOT NULL DEFAULT 0,
    "resultsJson" JSONB NOT NULL DEFAULT '{}',
    "detailsJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChecklistSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Part_tenantId_idx" ON "Part"("tenantId");

-- CreateIndex
CREATE INDEX "PartTransaction_tenantId_idx" ON "PartTransaction"("tenantId");

-- CreateIndex
CREATE INDEX "PartTransaction_tenantId_partId_idx" ON "PartTransaction"("tenantId", "partId");

-- CreateIndex
CREATE INDEX "PartTransaction_tenantId_recordId_idx" ON "PartTransaction"("tenantId", "recordId");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_tenantId_idx" ON "ChecklistTemplate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplate_tenantId_name_key" ON "ChecklistTemplate"("tenantId", "name");

-- CreateIndex
CREATE INDEX "ChecklistTemplateVersion_tenantId_idx" ON "ChecklistTemplateVersion"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplateVersion_templateId_version_key" ON "ChecklistTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "ChecklistSubmission_tenantId_idx" ON "ChecklistSubmission"("tenantId");

-- CreateIndex
CREATE INDEX "ChecklistSubmission_tenantId_subjectKind_subjectRef_idx" ON "ChecklistSubmission"("tenantId", "subjectKind", "subjectRef");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistSubmission_tenantId_submissionNumber_key" ON "ChecklistSubmission"("tenantId", "submissionNumber");

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartTransaction" ADD CONSTRAINT "PartTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartTransaction" ADD CONSTRAINT "PartTransaction_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartTransaction" ADD CONSTRAINT "PartTransaction_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MaintenanceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateVersion" ADD CONSTRAINT "ChecklistTemplateVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateVersion" ADD CONSTRAINT "ChecklistTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistSubmission" ADD CONSTRAINT "ChecklistSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistSubmission" ADD CONSTRAINT "ChecklistSubmission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistSubmission" ADD CONSTRAINT "ChecklistSubmission_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "ChecklistTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

