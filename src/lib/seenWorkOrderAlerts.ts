import {
  canonicalWorkOrderAlertId,
  readDismissedWorkOrderIds,
  rememberDismissedWorkOrderIds,
} from '@/lib/notificationInbox';

function browserStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function authToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

/** Write this browser immediately, then the account record other devices read. */
export function saveSeenWorkOrderIds(ids: string[]): Set<string> {
  const canonical = ids
    .map((id) => canonicalWorkOrderAlertId(id))
    .filter((id): id is string => Boolean(id));
  const next = rememberDismissedWorkOrderIds(browserStorage(), canonical);
  const token = authToken();
  if (token && canonical.length > 0) {
    void fetch('/api/notifications/seen-work-orders', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ids: canonical }),
    }).catch(() => {
      // This browser already hid them. The next sync retries the account write.
    });
  }
  return next;
}

/** Union of this browser and the account, and retry any local ids the server does not have yet. */
export async function syncSeenWorkOrderIds(): Promise<Set<string>> {
  const local = readDismissedWorkOrderIds(browserStorage());
  const token = authToken();
  if (!token) return local;
  try {
    const res = await fetch('/api/notifications/seen-work-orders', {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return local;
    const data = await res.json().catch(() => ({}));
    const server = new Set<string>();
    if (Array.isArray(data.ids)) {
      for (const id of data.ids) {
        if (typeof id !== 'string') continue;
        const canonical = canonicalWorkOrderAlertId(id);
        if (canonical) server.add(canonical);
      }
    }
    const missing = Array.from(local).filter((id) => !server.has(id));
    if (missing.length > 0) {
      await fetch('/api/notifications/seen-work-orders', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: missing }),
      }).catch(() => undefined);
      for (const id of missing) server.add(id);
    }
    const merged = rememberDismissedWorkOrderIds(browserStorage(), Array.from(server));
    for (const id of local) merged.add(id);
    return merged;
  } catch {
    return local;
  }
}
