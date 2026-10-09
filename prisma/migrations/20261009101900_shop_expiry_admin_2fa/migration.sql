-- Nullable shop compliance fields and admin two-factor columns.
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "licenseExpiresAt" TIMESTAMP(3);
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "insuranceExpiresAt" TIMESTAMP(3);
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "entityType" TEXT;

ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN;
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;
