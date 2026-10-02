-- Messages the support inbox webhook has already confirmed with Resend.
CREATE TABLE IF NOT EXISTS "support_inbox_messages" (
    "id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "recipients" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "bodyText" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "support_inbox_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "support_inbox_messages_receivedAt_idx" ON "support_inbox_messages"("receivedAt");
