-- CreateTable work_order_time_entries
CREATE TABLE "work_order_time_entries" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "techId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "clockIn" TIMESTAMP(3) NOT NULL,
    "clockOut" TIMESTAMP(3),
    "hoursSpent" DOUBLE PRECISION,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_order_time_entries_workOrderId_idx" ON "work_order_time_entries"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_time_entries_techId_idx" ON "work_order_time_entries"("techId");

-- CreateIndex
CREATE INDEX "work_order_time_entries_shopId_idx" ON "work_order_time_entries"("shopId");

-- CreateIndex
CREATE INDEX "work_order_time_entries_clockIn_idx" ON "work_order_time_entries"("clockIn");

-- AddForeignKey
ALTER TABLE "work_order_time_entries" ADD CONSTRAINT "work_order_time_entries_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_time_entries" ADD CONSTRAINT "work_order_time_entries_techId_fkey" FOREIGN KEY ("techId") REFERENCES "techs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
