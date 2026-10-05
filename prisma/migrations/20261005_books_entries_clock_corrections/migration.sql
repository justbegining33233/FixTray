-- Shop ledger lines and clock-correction reasons.
CREATE TABLE IF NOT EXISTS "books_entries" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "appliesTo" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "sourceId" TEXT,
    "stripePaymentIntentId" TEXT,
    "idempotencyKey" TEXT,
    "depositAt" TIMESTAMP(3),
    "actorId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "books_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "books_entries_idempotencyKey_key" ON "books_entries"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "books_entries_shopId_createdAt_idx" ON "books_entries"("shopId", "createdAt");
CREATE INDEX IF NOT EXISTS "books_entries_workOrderId_idx" ON "books_entries"("workOrderId");
CREATE INDEX IF NOT EXISTS "books_entries_stripePaymentIntentId_idx" ON "books_entries"("stripePaymentIntentId");

DO $$ BEGIN
  ALTER TABLE "books_entries" ADD CONSTRAINT "books_entries_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "books_entries" ADD CONSTRAINT "books_entries_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "clock_corrections" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "clock" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "beforeMinutes" INTEGER NOT NULL,
    "afterMinutes" INTEGER NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clock_corrections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "clock_corrections_shopId_createdAt_idx" ON "clock_corrections"("shopId", "createdAt");
CREATE INDEX IF NOT EXISTS "clock_corrections_entryId_idx" ON "clock_corrections"("entryId");

DO $$ BEGIN
  ALTER TABLE "clock_corrections" ADD CONSTRAINT "clock_corrections_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
