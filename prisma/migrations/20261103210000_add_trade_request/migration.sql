-- CreateTable
CREATE TABLE "TradeRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shiftType" TEXT NOT NULL DEFAULT '',
    "requesterUsername" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "counterpartUsername" TEXT NOT NULL,
    "counterpartName" TEXT NOT NULL,
    "tradeDate" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "paybackRequired" BOOLEAN NOT NULL DEFAULT false,
    "paybackDate" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'requested',
    "denialReason" TEXT NOT NULL DEFAULT '',
    "scheduleChangeJson" JSONB,
    "historyJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradeRequest_tenantId_createdAt_idx" ON "TradeRequest"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "TradeRequest_tenantId_requesterUsername_idx" ON "TradeRequest"("tenantId", "requesterUsername");

-- CreateIndex
CREATE INDEX "TradeRequest_tenantId_counterpartUsername_idx" ON "TradeRequest"("tenantId", "counterpartUsername");

-- AddForeignKey
ALTER TABLE "TradeRequest" ADD CONSTRAINT "TradeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
