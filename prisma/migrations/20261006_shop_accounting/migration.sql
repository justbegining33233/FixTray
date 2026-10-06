-- Additive shop accounting: timezone, tax flags, chart of accounts, journal,
-- vendor bills, inventory snapshots, accountant logins, and bank deposits.
-- Safe on live data. Existing rows keep working. Nothing is dropped or rewritten.

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/New_York';
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "qboId" TEXT;
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "costCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "qboId" TEXT;
ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "laborTaxable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "partsTaxable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "qboId" TEXT;

CREATE TABLE IF NOT EXISTS "ledger_accounts" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "systemKey" TEXT NOT NULL,
    "qboAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_accounts_shopId_systemKey_key" ON "ledger_accounts"("shopId", "systemKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_accounts_shopId_code_key" ON "ledger_accounts"("shopId", "code");
CREATE INDEX IF NOT EXISTS "ledger_accounts_shopId_idx" ON "ledger_accounts"("shopId");

CREATE TABLE IF NOT EXISTS "journal_entries" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "memo" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "journal_entries_shopId_sourceType_sourceId_key" ON "journal_entries"("shopId", "sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "journal_entries_shopId_entryDate_idx" ON "journal_entries"("shopId", "entryDate");

CREATE TABLE IF NOT EXISTS "journal_lines" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountKey" TEXT NOT NULL,
    "debitCents" INTEGER NOT NULL DEFAULT 0,
    "creditCents" INTEGER NOT NULL DEFAULT 0,
    "workOrderId" TEXT,
    "memo" TEXT,
    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "journal_lines_entryId_idx" ON "journal_lines"("entryId");
CREATE INDEX IF NOT EXISTS "journal_lines_accountKey_idx" ON "journal_lines"("accountKey");

CREATE TABLE IF NOT EXISTS "vendor_bills" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "memo" TEXT NOT NULL DEFAULT '',
    "qboId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vendor_bills_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "vendor_bills_shopId_billDate_idx" ON "vendor_bills"("shopId", "billDate");
CREATE INDEX IF NOT EXISTS "vendor_bills_vendorId_idx" ON "vendor_bills"("vendorId");

CREATE TABLE IF NOT EXISTS "vendor_bill_lines" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitCostCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    CONSTRAINT "vendor_bill_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "vendor_bill_lines_billId_idx" ON "vendor_bill_lines"("billId");

CREATE TABLE IF NOT EXISTS "bill_payments" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "qboId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bill_payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "bill_payments_shopId_paidAt_idx" ON "bill_payments"("shopId", "paidAt");
CREATE INDEX IF NOT EXISTS "bill_payments_billId_idx" ON "bill_payments"("billId");

CREATE TABLE IF NOT EXISTS "inventory_value_snapshots" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "itemId" TEXT,
    "asOf" TIMESTAMP(3) NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitCostCents" INTEGER NOT NULL,
    "valueCents" INTEGER NOT NULL,
    CONSTRAINT "inventory_value_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "inventory_value_snapshots_shopId_asOf_idx" ON "inventory_value_snapshots"("shopId", "asOf");

CREATE TABLE IF NOT EXISTS "shop_accountants" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_accountants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shop_accountants_shopId_email_key" ON "shop_accountants"("shopId", "email");
CREATE INDEX IF NOT EXISTS "shop_accountants_email_idx" ON "shop_accountants"("email");

CREATE TABLE IF NOT EXISTS "bank_deposits" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "depositedAt" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "sourceId" TEXT,
    "qboId" TEXT,
    "workOrderIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "memo" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_deposits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "bank_deposits_shopId_depositedAt_idx" ON "bank_deposits"("shopId", "depositedAt");
