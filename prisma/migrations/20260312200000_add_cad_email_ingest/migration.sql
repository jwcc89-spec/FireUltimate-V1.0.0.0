-- CreateTable
CREATE TABLE "CadEmailIngest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "fromAddress" TEXT NOT NULL DEFAULT '',
    "toAddress" TEXT NOT NULL DEFAULT '',
    "rawBody" TEXT NOT NULL DEFAULT '',
    "headersJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CadEmailIngest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CadEmailIngest_tenantId_idx" ON "CadEmailIngest"("tenantId");

-- CreateIndex
CREATE INDEX "CadEmailIngest_createdAt_idx" ON "CadEmailIngest"("createdAt");

-- AddForeignKey
ALTER TABLE "CadEmailIngest" ADD CONSTRAINT "CadEmailIngest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
