-- Per-user record that a synthetic work-order bell item was opened.
CREATE TABLE IF NOT EXISTS "seen_work_order_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "shopId" TEXT,
    "workOrderId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seen_work_order_alerts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "seen_work_order_alerts_userId_workOrderId_key"
  ON "seen_work_order_alerts"("userId", "workOrderId");

CREATE INDEX IF NOT EXISTS "seen_work_order_alerts_userId_seenAt_idx"
  ON "seen_work_order_alerts"("userId", "seenAt");
