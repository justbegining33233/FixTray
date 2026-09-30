-- Preferred language on each account, plus the original chat text and a locale map.
-- Production deploys also add these columns from ensureProductionColumns.
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT;
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT;
ALTER TABLE "techs" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT;
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sourceLocale" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "translations" TEXT;
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "sourceLocale" TEXT;
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "translations" TEXT;
ALTER TABLE "customer_messages" ADD COLUMN IF NOT EXISTS "sourceLocale" TEXT;
ALTER TABLE "customer_messages" ADD COLUMN IF NOT EXISTS "translations" TEXT;
ALTER TABLE "portal_chat_messages" ADD COLUMN IF NOT EXISTS "sourceLocale" TEXT;
ALTER TABLE "portal_chat_messages" ADD COLUMN IF NOT EXISTS "translations" TEXT;
