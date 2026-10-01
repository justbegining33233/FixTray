-- Tie portal chat, including the global channel, to the shop and account that posted it
-- so a finished demo can delete those messages without matching display names.
ALTER TABLE "portal_chat_messages" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
ALTER TABLE "portal_chat_messages" ADD COLUMN IF NOT EXISTS "actorId" TEXT;
CREATE INDEX IF NOT EXISTS "portal_chat_messages_shopId_idx" ON "portal_chat_messages"("shopId");
CREATE INDEX IF NOT EXISTS "portal_chat_messages_actorId_idx" ON "portal_chat_messages"("actorId");
