-- VIS form round-trip fields: referral name, fee labels, payment-link customer
ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "referredName" TEXT;
ALTER TABLE "environmental_fees" ADD COLUMN IF NOT EXISTS "feeType" TEXT;
ALTER TABLE "environmental_fees" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "customerName" TEXT;
