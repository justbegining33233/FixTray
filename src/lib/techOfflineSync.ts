/**
 * Pure rules for tech offline sync. Append-only work merges by client id.
 * Status changes do not overwrite a shop edit or a closed job.
 */

export const TERMINAL_STATUSES = new Set([
  'completed',
  'closed',
  'cancelled',
  'canceled',
  'denied-estimate',
]);

/** Statuses a tech may set from the field. Payments and closing the ticket stay online. */
export const TECH_OFFLINE_STATUSES = new Set([
  'assigned',
  'en-route',
  'in-progress',
  'waiting-estimate',
  'completed',
]);

export const NEEDS_NETWORK_STATUSES = new Set([
  'waiting-for-payment',
  'paid',
  'closed',
]);

export type SyncStatus = 'applied' | 'duplicate' | 'conflict' | 'rejected';

export type SyncResult = {
  idempotencyKey: string;
  kind: string;
  status: SyncStatus;
  message?: string;
  serverStatus?: string;
  workOrderId?: string;
};

export function mergeByClientId<T extends { clientId?: string }>(
  existing: unknown,
  item: T,
): { items: T[]; added: boolean } {
  const list = (Array.isArray(existing) ? existing : []) as T[];
  if (item.clientId && list.some((row) => row && row.clientId === item.clientId)) {
    return { items: list, added: false };
  }
  return { items: [...list, item], added: true };
}

export function statusDecision(current: string, base: string, next: string): 'apply' | 'noop' | 'conflict' {
  if (!next || current === next) return 'noop';
  if (TERMINAL_STATUSES.has(current)) return 'conflict';
  if (current !== base) return 'conflict';
  return 'apply';
}

export function reviewStatusChoice(next: string): { ok: true } | { ok: false; message: string } {
  if (NEEDS_NETWORK_STATUSES.has(next)) {
    return { ok: false, message: 'Payments and closing a ticket need a connection.' };
  }
  if (!TECH_OFFLINE_STATUSES.has(next)) {
    return { ok: false, message: 'That status cannot be set offline.' };
  }
  return { ok: true };
}

export function isCloudinaryUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:'
      && (parsed.hostname.endsWith('res.cloudinary.com') || parsed.hostname.endsWith('cloudinary.com'));
  } catch {
    return false;
  }
}

const KEY_RE = /^[A-Za-z0-9:_-]{8,80}$/;

export function validClientKey(value: unknown): value is string {
  return typeof value === 'string' && KEY_RE.test(value);
}
