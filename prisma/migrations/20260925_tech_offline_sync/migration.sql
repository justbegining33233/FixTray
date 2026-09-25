-- Tech offline sync: idempotency receipts plus client ids on clock entries and photos.
-- Production promotes run this migration separately from the app deploy.

ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "clientMutationId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "time_entries_clientMutationId_key" ON "time_entries"("clientMutationId");

ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "clientMutationId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "photos_clientMutationId_key" ON "photos"("clientMutationId");

CREATE TABLE IF NOT EXISTS "sync_receipts" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "techId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sync_receipts_idempotencyKey_key" ON "sync_receipts"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "sync_receipts_techId_idx" ON "sync_receipts"("techId");
