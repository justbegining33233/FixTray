-- Platform default language selected in Global Settings / System Settings.
-- Production deploys also add this column from ensureProductionColumns.
ALTER TABLE "platform_config" ADD COLUMN IF NOT EXISTS "defaultLanguage" TEXT NOT NULL DEFAULT 'en';
