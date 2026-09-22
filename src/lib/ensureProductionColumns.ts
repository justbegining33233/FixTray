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
