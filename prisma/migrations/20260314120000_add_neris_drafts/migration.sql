-- CreateTable
CREATE TABLE "NerisDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "callNumber" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NerisDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NerisDraft_tenantId_callNumber_key" ON "NerisDraft"("tenantId", "callNumber");

-- CreateIndex
CREATE INDEX "NerisDraft_tenantId_idx" ON "NerisDraft"("tenantId");

-- AddForeignKey
ALTER TABLE "NerisDraft" ADD CONSTRAINT "NerisDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
