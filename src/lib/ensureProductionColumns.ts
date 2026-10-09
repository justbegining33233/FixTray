import prisma from '@/lib/prisma';

/**
 * Additive columns the Prisma client selects, but production deploys do not
 * run `prisma migrate deploy` (DATABASE_URL is runtime-only on Vercel).
 * Invoice closeout, shop settings, the service catalog, and tax rules all
 * throw — and the UI shows a generic failure — when any of these are missing.
 *
 * Every statement is idempotent. Safe to run on every cold start.
 * Shop-accounting tables are not created here. They come from
 * prisma/migrations/20261006_shop_accounting when the release is promoted.
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
  `CREATE TABLE IF NOT EXISTS "email_templates" (
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("key")
  )`,
] as const;

let pending: Promise<void> | null = null;

export function ensureProductionColumns(): Promise<void> {
  // A production build must not touch the database. Shop-accounting tables
  // come from prisma/migrations/20261006_shop_accounting at promote, not here.
  if (process.env.NEXT_PHASE === 'phase-production-build') return Promise.resolve();
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
