import { addressList, emailAddress, isSupportInboxRecipient, platformFromHeader, SUPPORT_INBOX } from '@/lib/platformEmailAccess';

const RESEND_EMAILS = 'https://api.resend.com/emails';
const RESEND_RECEIVING = 'https://api.resend.com/emails/receiving';
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

function recipientAddresses(row: Record<string, unknown>): string[] {
  const seen = new Set<string>();
  const addresses: string[] = [];
  for (const field of [row.to, row.cc, row.bcc, row.received_for]) {
    for (const item of addressList(field)) {
      const key = emailAddress(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      addresses.push(item);
    }
  }
  return addresses;
}

function summaryFrom(row: Record<string, unknown>): PlatformMailSummary | null {
  const id = typeof row.id === 'string' ? row.id : typeof row.email_id === 'string' ? row.email_id : '';
  if (!EMAIL_ID.test(id)) return null;
  const createdAt = typeof row.created_at === 'string'
    ? row.created_at
    : typeof row.createdAt === 'string'
      ? row.createdAt
      : '';
  return {
    id,
    from: typeof row.from === 'string' ? row.from : '',
    to: recipientAddresses(row),
    subject: typeof row.subject === 'string' ? row.subject : '',
    createdAt,
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
  if (!from) return { ok: false, status: 400, error: 'Messages send from support@fixtray.app' };
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

const INBOX_UNAVAILABLE = 'The support inbox could not be loaded.';
const SEND_UNAVAILABLE = 'Email could not be reached';

function requestFailure(error: string, status = 502): MailboxResult<never> {
  return { ok: false, status, error };
}

async function resendRequest(
  path: string,
  init?: RequestInit,
  failure: string = SEND_UNAVAILABLE,
): Promise<MailboxResult<Record<string, unknown>>> {
  const key = resendKey();
  if (!key) return { ok: false, status: 503, error: 'Email is not configured' };
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  } catch (error) {
    console.error('[platformMailbox] request failed', redact(error instanceof Error ? error.message : '', key));
    return requestFailure(failure);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== 'object') {
    const message = body && typeof body === 'object' && typeof (body as { message?: unknown }).message === 'string'
      ? (body as { message: string }).message
      : '';
    console.error('[platformMailbox] resend error', response.status, redact(message, key));
    return requestFailure(failure);
  }
  return { ok: true, data: body as Record<string, unknown> };
}

export function mergeSupportInbox(stored: PlatformMailSummary[], live: PlatformMailSummary[]): PlatformMailSummary[] {
  const byId = new Map<string, PlatformMailSummary>();
  for (const item of stored) {
    if (isSupportInboxRecipient(item.to)) byId.set(item.id, item);
  }
  for (const item of live) {
    if (!isSupportInboxRecipient(item.to)) continue;
    const previous = byId.get(item.id);
    byId.set(item.id, previous ? {
      ...previous,
      ...item,
      id: item.id,
      from: item.from || previous.from,
      subject: item.subject || previous.subject,
      to: item.to.length > 0 ? item.to : previous.to,
      createdAt: item.createdAt || previous.createdAt,
    } : item);
  }
  return [...byId.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

function listPage(body: Record<string, unknown>): { rows: unknown[]; hasMore: boolean } {
  if (Array.isArray(body.data)) {
    return { rows: body.data, hasMore: body.has_more === true };
  }
  const nested = body.data;
  if (nested && typeof nested === 'object') {
    const record = nested as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return { rows: record.data, hasMore: record.has_more === true };
    }
  }
  return { rows: [], hasMore: false };
}

function receivedSummaries(rows: unknown[]): PlatformMailSummary[] {
  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map(summaryFrom)
    .filter((row): row is PlatformMailSummary => row !== null && isSupportInboxRecipient(row.to));
}

function sortInbox(rows: PlatformMailSummary[]): PlatformMailSummary[] {
  const byId = new Map<string, PlatformMailSummary>();
  for (const row of rows) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

/**
 * Inbox for support@fixtray.app from Resend inbound, not the sent-mail log.
 * The receiving list is every address on the domain, newest first. Support
 * mail is kept across later pages so a full first page of other recipients
 * cannot hide it.
 */
export async function listReceivedSupportMail(limit = 20): Promise<MailboxResult<PlatformMailSummary[]>> {
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number.isFinite(limit) ? limit : 20)));
  const found: PlatformMailSummary[] = [];
  let after = '';
  for (let page = 0; page < 5; page += 1) {
    const query = new URLSearchParams({ limit: String(pageSize) });
    if (after) query.set('after', after);
    const result = await resendRequest(`${RESEND_RECEIVING}?${query.toString()}`, undefined, INBOX_UNAVAILABLE);
    if (!result.ok) return found.length > 0 ? { ok: true, data: sortInbox(found) } : result;
    const pageBody = listPage(result.data);
    const rows = pageBody.rows;
    found.push(...receivedSummaries(rows));
    const hasMore = pageBody.hasMore;
    const last = rows.length > 0 && rows[rows.length - 1] && typeof rows[rows.length - 1] === 'object'
      ? (rows[rows.length - 1] as Record<string, unknown>).id
      : '';
    if (!hasMore || typeof last !== 'string' || !EMAIL_ID.test(last) || last === after) break;
    after = last;
  }
  return { ok: true, data: sortInbox(found) };
}

export async function readReceivedSupportMail(id: string): Promise<MailboxResult<PlatformMailDetail>> {
  if (!EMAIL_ID.test(id)) return { ok: false, status: 400, error: 'Unknown message' };
  const result = await resendRequest(`${RESEND_RECEIVING}/${encodeURIComponent(id)}`, undefined, INBOX_UNAVAILABLE);
  if (!result.ok) return result;
  const summary = summaryFrom(result.data);
  if (!summary || !summary.to.some((item) => emailAddress(item) === SUPPORT_INBOX)) {
    return { ok: false, status: 404, error: 'Unknown message' };
  }
  const text = typeof result.data.text === 'string' ? result.data.text.trim() : '';
  const html = typeof result.data.html === 'string' ? result.data.html : '';
  return { ok: true, data: { ...summary, lastEvent: summary.lastEvent || 'received', text: text || plainFromHtml(htmlBody(html)) } };
}

function htmlBody(html: string): string {
  const base64 = html.match(/^data:text\/html(?:;charset=[^;,]+)?;base64,([\s\S]+)$/i);
  if (base64) {
    try {
      return Buffer.from(base64[1], 'base64').toString('utf8');
    } catch {
      return html;
    }
  }
  const encoded = html.match(/^data:text\/html(?:;charset=[^;,]+)?,([\s\S]+)$/i);
  if (!encoded) return html;
  try {
    return decodeURIComponent(encoded[1]);
  } catch {
    return encoded[1];
  }
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
