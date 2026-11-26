-- CreateTable
CREATE TABLE "MapMarkerType" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'marker',
    "color" TEXT NOT NULL DEFAULT '#16a34a',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MapMarkerType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapMarker" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "markerTypeId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "detailsJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MapMarker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Geofence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'custom',
    "color" TEXT NOT NULL DEFAULT '#dc2626',
    "parentId" TEXT,
    "geometryJson" JSONB NOT NULL,
    "linkedPropertyId" TEXT NOT NULL DEFAULT '',
    "linkedPrePlanId" TEXT NOT NULL DEFAULT '',
    "detailsJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Geofence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MapMarkerType_tenantId_idx" ON "MapMarkerType"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MapMarkerType_tenantId_name_key" ON "MapMarkerType"("tenantId", "name");

-- CreateIndex
CREATE INDEX "MapMarker_tenantId_idx" ON "MapMarker"("tenantId");

-- CreateIndex
CREATE INDEX "MapMarker_tenantId_markerTypeId_idx" ON "MapMarker"("tenantId", "markerTypeId");

-- CreateIndex
CREATE INDEX "Geofence_tenantId_idx" ON "Geofence"("tenantId");

-- CreateIndex
CREATE INDEX "Geofence_tenantId_kind_idx" ON "Geofence"("tenantId", "kind");

-- AddForeignKey
ALTER TABLE "MapMarkerType" ADD CONSTRAINT "MapMarkerType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapMarker" ADD CONSTRAINT "MapMarker_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapMarker" ADD CONSTRAINT "MapMarker_markerTypeId_fkey" FOREIGN KEY ("markerTypeId") REFERENCES "MapMarkerType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Geofence" ADD CONSTRAINT "Geofence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Geofence" ADD CONSTRAINT "Geofence_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Geofence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
