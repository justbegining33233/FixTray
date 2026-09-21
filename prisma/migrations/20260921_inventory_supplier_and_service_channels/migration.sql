-- VIS-104: persist supplier and notes on inventory items
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "supplier" TEXT;
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- VIS-110: shop-controlled roadside / in-shop / active eligibility
ALTER TABLE "shop_services" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "shop_services" ADD COLUMN IF NOT EXISTS "availableInShop" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "shop_services" ADD COLUMN IF NOT EXISTS "availableRoadside" BOOLEAN NOT NULL DEFAULT true;
