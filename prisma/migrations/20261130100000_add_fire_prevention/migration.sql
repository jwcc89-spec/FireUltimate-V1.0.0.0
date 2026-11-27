-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "normalizedAddress" TEXT NOT NULL DEFAULT '',
    "propertyType" TEXT NOT NULL DEFAULT 'residential',
    "occupancyType" TEXT NOT NULL DEFAULT '',
    "squareFeet" INTEGER,
    "yearBuilt" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "streetViewPanoId" TEXT NOT NULL DEFAULT '',
    "streetViewHeading" DOUBLE PRECISION,
    "streetViewPitch" DOUBLE PRECISION,
    "streetViewZoom" DOUBLE PRECISION,
    "photoRef" TEXT NOT NULL DEFAULT '',
    "detailsJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyContact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "businessName" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT '',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "addressStreet" TEXT NOT NULL DEFAULT '',
    "addressUnit" TEXT NOT NULL DEFAULT '',
    "addressCity" TEXT NOT NULL DEFAULT '',
    "addressState" TEXT NOT NULL DEFAULT '',
    "addressZip" TEXT NOT NULL DEFAULT '',
    "detailsJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PropertyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrePlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'basic',
    "title" TEXT NOT NULL DEFAULT 'Pre-Plan',
    "reviewedOn" DATE,
    "detailsJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PrePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inspectionNumber" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "inspectionType" TEXT NOT NULL DEFAULT '',
    "isReinspection" BOOLEAN NOT NULL DEFAULT false,
    "reinspectionOfId" TEXT,
    "receivedOn" DATE,
    "scheduledOn" DATE,
    "scheduledTime" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "leadInspector" TEXT NOT NULL DEFAULT '',
    "otherInspectors" JSONB NOT NULL DEFAULT '[]',
    "reason" TEXT NOT NULL DEFAULT '',
    "district" TEXT NOT NULL DEFAULT '',
    "division" TEXT NOT NULL DEFAULT '',
    "station" TEXT NOT NULL DEFAULT '',
    "shift" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT '',
    "templateVersionId" TEXT,
    "completedOn" DATE,
    "resultsJson" JSONB NOT NULL DEFAULT '{}',
    "detailsJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Property_tenantId_idx" ON "Property"("tenantId");

-- CreateIndex
CREATE INDEX "Property_tenantId_normalizedAddress_idx" ON "Property"("tenantId", "normalizedAddress");

-- CreateIndex
CREATE INDEX "Property_tenantId_propertyType_idx" ON "Property"("tenantId", "propertyType");

-- CreateIndex
CREATE INDEX "PropertyContact_tenantId_idx" ON "PropertyContact"("tenantId");

-- CreateIndex
CREATE INDEX "PropertyContact_tenantId_propertyId_idx" ON "PropertyContact"("tenantId", "propertyId");

-- CreateIndex
CREATE INDEX "PrePlan_tenantId_idx" ON "PrePlan"("tenantId");

-- CreateIndex
CREATE INDEX "PrePlan_tenantId_propertyId_idx" ON "PrePlan"("tenantId", "propertyId");

-- CreateIndex
CREATE INDEX "Inspection_tenantId_idx" ON "Inspection"("tenantId");

-- CreateIndex
CREATE INDEX "Inspection_tenantId_propertyId_idx" ON "Inspection"("tenantId", "propertyId");

-- CreateIndex
CREATE INDEX "Inspection_tenantId_scheduledOn_idx" ON "Inspection"("tenantId", "scheduledOn");

-- CreateIndex
CREATE INDEX "Inspection_tenantId_status_idx" ON "Inspection"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_tenantId_inspectionNumber_key" ON "Inspection"("tenantId", "inspectionNumber");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyContact" ADD CONSTRAINT "PropertyContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyContact" ADD CONSTRAINT "PropertyContact_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrePlan" ADD CONSTRAINT "PrePlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrePlan" ADD CONSTRAINT "PrePlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "ChecklistTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

