-- VIS-025: remember the state/county chosen on a tax rule
ALTER TABLE "tax_rules" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "tax_rules" ADD COLUMN IF NOT EXISTS "county" TEXT;
