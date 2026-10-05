'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SESSION_KEY = 'ft_visit_session';
const SESSION_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let lastRecordedPath = '';

function visitSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && SESSION_RE.test(existing)) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

/** Records the page the browser is showing. The server hashes the IP. */
export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname === lastRecordedPath) return;
    lastRecordedPath = pathname;
    const body = JSON.stringify({
      path: pathname,
      sessionId: visitSessionId(),
      referrer: typeof document !== 'undefined' ? document.referrer || null : null,
    });
    void fetch('/api/analytics/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
