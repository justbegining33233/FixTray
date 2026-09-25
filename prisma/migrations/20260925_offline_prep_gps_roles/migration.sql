-- Offline prep, GPS breadcrumbs, and role-safe message sync.
-- Production promotes run this migration separately from the app deploy.

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "clientMutationId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "messages_clientMutationId_key" ON "messages"("clientMutationId");

ALTER TABLE "customer_messages" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;
ALTER TABLE "customer_messages" ADD COLUMN IF NOT EXISTS "clientMutationId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "customer_messages_clientMutationId_key" ON "customer_messages"("clientMutationId");

ALTER TABLE "sync_receipts" ADD COLUMN IF NOT EXISTS "deviceAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "tech_location_pings" (
    "id" TEXT NOT NULL,
    "techId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "deviceAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockAdjusted" BOOLEAN NOT NULL DEFAULT false,
    "clientMutationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tech_location_pings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tech_location_pings_clientMutationId_key" ON "tech_location_pings"("clientMutationId");
CREATE INDEX IF NOT EXISTS "tech_location_pings_techId_deviceAt_idx" ON "tech_location_pings"("techId", "deviceAt");
CREATE INDEX IF NOT EXISTS "tech_location_pings_workOrderId_idx" ON "tech_location_pings"("workOrderId");
