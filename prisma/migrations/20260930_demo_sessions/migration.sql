-- Demo shop logins. The 30-minute clock is stored here and starts at first login.
CREATE TABLE IF NOT EXISTS "demo_sessions" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "seedCustomerId" TEXT,
    "firstLoginAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "resetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "demo_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "demo_sessions_shopId_key" ON "demo_sessions"("shopId");
CREATE INDEX IF NOT EXISTS "demo_sessions_email_idx" ON "demo_sessions"("email");
CREATE INDEX IF NOT EXISTS "demo_sessions_expiresAt_idx" ON "demo_sessions"("expiresAt");
