-- ShopSettings.require2FA is selected on settings load and tech login,
-- but it was never added to a migration (only the Prisma schema).
ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "require2FA" BOOLEAN NOT NULL DEFAULT false;
