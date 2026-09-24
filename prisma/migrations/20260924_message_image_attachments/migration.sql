-- Optional picture on a chat line. Existing rows stay text-only.
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachmentType" TEXT;

ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "attachmentType" TEXT;
