-- CreateTable
CREATE TABLE "CadParsingSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enableIncidentCreation" BOOLEAN NOT NULL DEFAULT false,
    "messageRulesJson" JSONB NOT NULL DEFAULT '[]',
    "incidentRulesJson" JSONB NOT NULL DEFAULT '[]',
    "incidentFieldMapJson" JSONB NOT NULL DEFAULT '{}',
    "incidentNumberExtractJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CadParsingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CadParsingSettings_tenantId_key" ON "CadParsingSettings"("tenantId");

-- CreateIndex
CREATE INDEX "CadParsingSettings_tenantId_idx" ON "CadParsingSettings"("tenantId");

-- AddForeignKey
ALTER TABLE "CadParsingSettings" ADD CONSTRAINT "CadParsingSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CadEmailAllowlistEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "patternType" TEXT NOT NULL DEFAULT 'domain_suffix',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CadEmailAllowlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CadEmailAllowlistEntry_tenantId_idx" ON "CadEmailAllowlistEntry"("tenantId");

-- CreateIndex
CREATE INDEX "CadEmailAllowlistEntry_tenantId_enabled_idx" ON "CadEmailAllowlistEntry"("tenantId", "enabled");

-- AddForeignKey
ALTER TABLE "CadEmailAllowlistEntry" ADD CONSTRAINT "CadEmailAllowlistEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
