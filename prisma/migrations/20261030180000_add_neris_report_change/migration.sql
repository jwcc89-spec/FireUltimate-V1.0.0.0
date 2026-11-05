-- CreateTable
CREATE TABLE "NerisReportChange" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "callNumber" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorUsername" TEXT NOT NULL,
    "fieldNames" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NerisReportChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NerisReportChange_tenantId_callNumber_createdAt_idx" ON "NerisReportChange"("tenantId", "callNumber", "createdAt");

-- AddForeignKey
ALTER TABLE "NerisReportChange" ADD CONSTRAINT "NerisReportChange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
