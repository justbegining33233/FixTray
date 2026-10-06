import prisma from '@/lib/prisma';

/**
 * Additive columns the Prisma client selects, but production deploys do not
 * run `prisma migrate deploy` (DATABASE_URL is runtime-only on Vercel).
 * Invoice closeout, shop settings, the service catalog, and tax rules all
 * throw — and the UI shows a generic failure — when any of these are missing.
 *
 * Every statement is idempotent. Safe to run on every cold start.
 */
export const PRODUCTION_COLUMN_STATEMENTS = [
  `ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "customerName" TEXT`,
  `ALTER TABLE "shop_services" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "shop_services" ADD COLUMN IF NOT EXISTS "availableInShop" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "shop_services" ADD COLUMN IF NOT EXISTS "availableRoadside" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "supplier" TEXT`,
  `ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
  `ALTER TABLE "tax_rules" ADD COLUMN IF NOT EXISTS "state" TEXT`,
  `ALTER TABLE "tax_rules" ADD COLUMN IF NOT EXISTS "county" TEXT`,
  `ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "referredName" TEXT`,
  `ALTER TABLE "environmental_fees" ADD COLUMN IF NOT EXISTS "feeType" TEXT`,
  `ALTER TABLE "environmental_fees" ADD COLUMN IF NOT EXISTS "description" TEXT`,
  `ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "require2FA" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "platform_config" ADD COLUMN IF NOT EXISTS "defaultLanguage" TEXT NOT NULL DEFAULT 'en'`,
  `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT`,
  `ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT`,
  `ALTER TABLE "techs" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT`,
  `ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sourceLocale" TEXT`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "translations" TEXT`,
  `ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "sourceLocale" TEXT`,
  `ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "translations" TEXT`,
  `ALTER TABLE "customer_messages" ADD COLUMN IF NOT EXISTS "sourceLocale" TEXT`,
  `ALTER TABLE "customer_messages" ADD COLUMN IF NOT EXISTS "translations" TEXT`,
  `ALTER TABLE "portal_chat_messages" ADD COLUMN IF NOT EXISTS "sourceLocale" TEXT`,
  `ALTER TABLE "portal_chat_messages" ADD COLUMN IF NOT EXISTS "translations" TEXT`,
  `ALTER TABLE "portal_chat_messages" ADD COLUMN IF NOT EXISTS "shopId" TEXT`,
  `ALTER TABLE "portal_chat_messages" ADD COLUMN IF NOT EXISTS "actorId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "portal_chat_messages_shopId_idx" ON "portal_chat_messages"("shopId")`,
  `CREATE INDEX IF NOT EXISTS "portal_chat_messages_actorId_idx" ON "portal_chat_messages"("actorId")`,
  `CREATE TABLE IF NOT EXISTS "demo_sessions" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "seedCustomerId" TEXT,
    "firstLoginAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "resetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "demo_sessions_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "demo_sessions_shopId_key" ON "demo_sessions"("shopId")`,
  `CREATE INDEX IF NOT EXISTS "demo_sessions_email_idx" ON "demo_sessions"("email")`,
  `CREATE INDEX IF NOT EXISTS "demo_sessions_expiresAt_idx" ON "demo_sessions"("expiresAt")`,
  `CREATE TABLE IF NOT EXISTS "books_entries" (
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
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "books_entries_idempotencyKey_key" ON "books_entries"("idempotencyKey")`,
  `CREATE INDEX IF NOT EXISTS "books_entries_shopId_createdAt_idx" ON "books_entries"("shopId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "books_entries_workOrderId_idx" ON "books_entries"("workOrderId")`,
  `CREATE INDEX IF NOT EXISTS "books_entries_stripePaymentIntentId_idx" ON "books_entries"("stripePaymentIntentId")`,
  `CREATE TABLE IF NOT EXISTS "clock_corrections" (
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
  )`,
  `CREATE INDEX IF NOT EXISTS "clock_corrections_shopId_createdAt_idx" ON "clock_corrections"("shopId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "clock_corrections_entryId_idx" ON "clock_corrections"("entryId")`,
  `ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/New_York'`,
  `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "qboId" TEXT`,
  `ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "costCents" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "qboId" TEXT`,
  `ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "laborTaxable" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "partsTaxable" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "qboId" TEXT`,
  `CREATE TABLE IF NOT EXISTS "ledger_accounts" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "systemKey" TEXT NOT NULL,
    "qboAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ledger_accounts_shopId_systemKey_key" ON "ledger_accounts"("shopId", "systemKey")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ledger_accounts_shopId_code_key" ON "ledger_accounts"("shopId", "code")`,
  `CREATE INDEX IF NOT EXISTS "ledger_accounts_shopId_idx" ON "ledger_accounts"("shopId")`,
  `CREATE TABLE IF NOT EXISTS "journal_entries" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "memo" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "journal_entries_shopId_sourceType_sourceId_key" ON "journal_entries"("shopId", "sourceType", "sourceId")`,
  `CREATE INDEX IF NOT EXISTS "journal_entries_shopId_entryDate_idx" ON "journal_entries"("shopId", "entryDate")`,
  `CREATE TABLE IF NOT EXISTS "journal_lines" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountKey" TEXT NOT NULL,
    "debitCents" INTEGER NOT NULL DEFAULT 0,
    "creditCents" INTEGER NOT NULL DEFAULT 0,
    "workOrderId" TEXT,
    "memo" TEXT,
    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "journal_lines_entryId_idx" ON "journal_lines"("entryId")`,
  `CREATE INDEX IF NOT EXISTS "journal_lines_accountKey_idx" ON "journal_lines"("accountKey")`,
  `CREATE TABLE IF NOT EXISTS "vendor_bills" (
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
  )`,
  `CREATE INDEX IF NOT EXISTS "vendor_bills_shopId_billDate_idx" ON "vendor_bills"("shopId", "billDate")`,
  `CREATE INDEX IF NOT EXISTS "vendor_bills_vendorId_idx" ON "vendor_bills"("vendorId")`,
  `CREATE TABLE IF NOT EXISTS "vendor_bill_lines" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitCostCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    CONSTRAINT "vendor_bill_lines_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "vendor_bill_lines_billId_idx" ON "vendor_bill_lines"("billId")`,
  `CREATE TABLE IF NOT EXISTS "bill_payments" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "qboId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bill_payments_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "bill_payments_shopId_paidAt_idx" ON "bill_payments"("shopId", "paidAt")`,
  `CREATE INDEX IF NOT EXISTS "bill_payments_billId_idx" ON "bill_payments"("billId")`,
  `CREATE TABLE IF NOT EXISTS "inventory_value_snapshots" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "itemId" TEXT,
    "asOf" TIMESTAMP(3) NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitCostCents" INTEGER NOT NULL,
    "valueCents" INTEGER NOT NULL,
    CONSTRAINT "inventory_value_snapshots_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "inventory_value_snapshots_shopId_asOf_idx" ON "inventory_value_snapshots"("shopId", "asOf")`,
  `CREATE TABLE IF NOT EXISTS "shop_accountants" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_accountants_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "shop_accountants_shopId_email_key" ON "shop_accountants"("shopId", "email")`,
  `CREATE INDEX IF NOT EXISTS "shop_accountants_email_idx" ON "shop_accountants"("email")`,
  `CREATE TABLE IF NOT EXISTS "bank_deposits" (
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
  )`,
  `CREATE INDEX IF NOT EXISTS "bank_deposits_shopId_depositedAt_idx" ON "bank_deposits"("shopId", "depositedAt")`,
] as const;

let pending: Promise<void> | null = null;

export function ensureProductionColumns(): Promise<void> {
  if (!process.env.DATABASE_URL) return Promise.resolve();
  if (!pending) {
    pending = applyColumns().catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

async function applyColumns(): Promise<void> {
  for (const statement of PRODUCTION_COLUMN_STATEMENTS) {
    await prisma.$executeRawUnsafe(statement);
  }
}
