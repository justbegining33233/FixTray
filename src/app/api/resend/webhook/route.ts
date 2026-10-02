import { NextRequest, NextResponse } from 'next/server';
import { handleResendWebhook } from '@/lib/resendWebhook';

/**
 * Resend calls this when inbound mail arrives.
 * Production URL: https://fixtray.app/api/resend/webhook
 * Event: email.received
 * Signing secret: RESEND_WEBHOOK_SECRET (server env only).
 */
export async function POST(request: NextRequest) {
  const payload = await request.text();
  const result = await handleResendWebhook(payload, {
    id: request.headers.get('svix-id'),
    timestamp: request.headers.get('svix-timestamp'),
    signature: request.headers.get('svix-signature'),
  });
  return NextResponse.json(result.body, { status: result.status });
}
