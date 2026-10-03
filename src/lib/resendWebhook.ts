import { Resend } from 'resend';
import { isSupportInboxRecipient } from '@/lib/platformEmailAccess';
import { readReceivedSupportMail } from '@/lib/platformMailbox';
import { rememberSupportInboxMessage } from '@/lib/supportInboxStore';

export type ResendWebhookHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

type WebhookResult = { status: number; body: { received?: boolean; error?: string } };

/**
 * Same shape as the Stripe webhook: raw body, signature headers, and the
 * signing secret from the server environment. A missing or bad signature
 * is rejected. The secret is never returned.
 */
export function verifyResendWebhook(payload: string, headers: ResendWebhookHeaders):
  | { ok: true; event: Record<string, unknown> }
  | { ok: false; status: number; error: string } {
  if (!headers.id || !headers.timestamp || !headers.signature) {
    return { ok: false, status: 400, error: 'Missing signature' };
  }
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return { ok: false, status: 500, error: 'Webhook secret not configured' };
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 500, error: 'Email is not configured' };
  }
  try {
    const event = new Resend(apiKey).webhooks.verify({
      payload,
      headers: {
        id: headers.id,
        timestamp: headers.timestamp,
        signature: headers.signature,
      },
      webhookSecret,
    });
    if (!event || typeof event !== 'object') {
      return { ok: false, status: 400, error: 'Invalid signature' };
    }
    return { ok: true, event: event as unknown as Record<string, unknown> };
  } catch {
    return { ok: false, status: 400, error: 'Invalid signature' };
  }
}

export async function handleResendWebhook(payload: string, headers: ResendWebhookHeaders): Promise<WebhookResult> {
  const verified = verifyResendWebhook(payload, headers);
  if (!verified.ok) return { status: verified.status, body: { error: verified.error } };

  if (verified.event.type !== 'email.received') {
    return { status: 200, body: { received: true } };
  }

  const data = verified.event.data;
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const addressedToSupport = [record.to, record.cc, record.bcc, record.received_for].some((field) => isSupportInboxRecipient(field));
  if (!addressedToSupport) {
    return { status: 200, body: { received: true } };
  }

  const emailId = typeof record.email_id === 'string' ? record.email_id : '';
  if (!emailId) return { status: 200, body: { received: true } };

  const message = await readReceivedSupportMail(emailId);
  if (!message.ok) return { status: 502, body: { error: message.error } };
  await rememberSupportInboxMessage(message.data);
  return { status: 200, body: { received: true } };
}
