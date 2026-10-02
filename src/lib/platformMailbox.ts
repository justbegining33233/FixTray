import { DEMO_FROM_EMAIL } from '@/lib/demoShopRules';
import { platformFromHeader } from '@/lib/platformEmailAccess';

const RESEND_EMAILS = 'https://api.resend.com/emails';
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_ID = /^[A-Za-z0-9_-]{1,128}$/;
const TO_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PlatformMailSummary = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  createdAt: string;
  lastEvent: string;
};

export type PlatformMailDetail = PlatformMailSummary & {
  text: string;
};

export type MailboxResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

type SendInput = {
  from: unknown;
  to: unknown;
  subject: unknown;
  text: unknown;
  requestId: unknown;
};

function resendKey(): string {
  return process.env.RESEND_API_KEY || '';
}

function redact(message: string, key: string): string {
  if (!message) return '';
  return key ? message.split(key).join('[redacted]') : message;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function summaryFrom(row: Record<string, unknown>): PlatformMailSummary | null {
  const id = typeof row.id === 'string' ? row.id : '';
  if (!EMAIL_ID.test(id)) return null;
  return {
    id,
    from: typeof row.from === 'string' ? row.from : '',
    to: asStringList(row.to),
    subject: typeof row.subject === 'string' ? row.subject : '',
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    lastEvent: typeof row.last_event === 'string' ? row.last_event : '',
  };
}

export function escapeEmailText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function plainFromHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlFromText(text: string): string {
  const blocks = text.split(/\n{2,}/).map((block) => {
    const lines = escapeEmailText(block).replace(/\n/g, '<br>');
    return `<p>${lines}</p>`;
  });
  return blocks.join('');
}

export function preparePlatformSend(input: SendInput): MailboxResult<{
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
}> {
  const from = platformFromHeader(input.from);
  if (!from) return { ok: false, status: 400, error: 'Choose a FixTray from address' };
  if (from.includes('noreply@fixtray.app') && from !== DEMO_FROM_EMAIL) {
    return { ok: false, status: 400, error: 'Choose a FixTray from address' };
  }
  const to = typeof input.to === 'string' ? input.to.trim() : '';
  if (!TO_ADDRESS.test(to) || to.length > 320) {
    return { ok: false, status: 400, error: 'Enter one email address' };
  }
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  if (!subject || subject.length > 200) {
    return { ok: false, status: 400, error: 'Enter a subject' };
  }
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!text || text.length > 8000) {
    return { ok: false, status: 400, error: 'Enter a message' };
  }
  const requestId = typeof input.requestId === 'string' ? input.requestId.trim() : '';
  if (!REQUEST_ID.test(requestId)) {
    return { ok: false, status: 400, error: 'Send the message again' };
  }
  return {
    ok: true,
    data: {
      from,
      to,
      subject,
      text,
      html: htmlFromText(text),
      idempotencyKey: `platform-mail/${requestId}`,
    },
  };
}

async function resendRequest(path: string, init?: RequestInit): Promise<MailboxResult<Record<string, unknown>>> {
  const key = resendKey();
  if (!key) return { ok: false, status: 503, error: 'Email is not configured' };
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  } catch (error) {
    console.error('[platformMailbox] request failed', redact(error instanceof Error ? error.message : '', key));
    return { ok: false, status: 502, error: 'Email could not be reached' };
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== 'object') {
    const message = body && typeof body === 'object' && typeof (body as { message?: unknown }).message === 'string'
      ? (body as { message: string }).message
      : '';
    console.error('[platformMailbox] resend error', response.status, redact(message, key));
    return { ok: false, status: 502, error: 'Email could not be reached' };
  }
  return { ok: true, data: body as Record<string, unknown> };
}

export async function listRecentPlatformMail(limit = 20): Promise<MailboxResult<PlatformMailSummary[]>> {
  const capped = Math.min(50, Math.max(1, Math.floor(Number.isFinite(limit) ? limit : 20)));
  const result = await resendRequest(`${RESEND_EMAILS}?limit=${capped}`);
  if (!result.ok) return result;
  const rows = Array.isArray(result.data.data) ? result.data.data : [];
  const emails = rows
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map(summaryFrom)
    .filter((row): row is PlatformMailSummary => row !== null);
  return { ok: true, data: emails };
}

export async function readPlatformMail(id: string): Promise<MailboxResult<PlatformMailDetail>> {
  if (!EMAIL_ID.test(id)) return { ok: false, status: 400, error: 'Unknown message' };
  const result = await resendRequest(`${RESEND_EMAILS}/${encodeURIComponent(id)}`);
  if (!result.ok) return result;
  const summary = summaryFrom(result.data);
  if (!summary) return { ok: false, status: 502, error: 'Email could not be reached' };
  const text = typeof result.data.text === 'string' ? result.data.text.trim() : '';
  const html = typeof result.data.html === 'string' ? result.data.html : '';
  return { ok: true, data: { ...summary, text: text || plainFromHtml(html) } };
}

export async function sendPlatformMail(input: SendInput): Promise<MailboxResult<{ id: string }>> {
  const prepared = preparePlatformSend(input);
  if (!prepared.ok) return prepared;
  const result = await resendRequest(RESEND_EMAILS, {
    method: 'POST',
    headers: { 'Idempotency-Key': prepared.data.idempotencyKey },
    body: JSON.stringify({
      from: prepared.data.from,
      to: [prepared.data.to],
      subject: prepared.data.subject,
      text: prepared.data.text,
      html: prepared.data.html,
    }),
  });
  if (!result.ok) return result;
  const id = typeof result.data.id === 'string' ? result.data.id : '';
  if (!id) return { ok: false, status: 502, error: 'Email could not be reached' };
  return { ok: true, data: { id } };
}
