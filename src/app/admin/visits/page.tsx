'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { FaChartBar } from 'react-icons/fa';
import Sidebar from '@/components/Sidebar';
import TopNavBar from '@/components/TopNavBar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { isPlatformEmailAccount } from '@/lib/platformEmailAccess';
import { useSessionUsername } from '@/lib/useSessionUsername';

type RecentPage = {
  path: string;
  createdAt: string;
  referrer: string | null;
};

type VisitSummary = {
  visitCount: number;
  uniqueVisitors: number;
  recentPages: RecentPage[];
};

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function PlatformVisitsPage() {
  const router = useRouter();
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const session = useSessionUsername();
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [summary, setSummary] = useState<VisitSummary | null>(null);
  const [error, setError] = useState('');
  const allowed = isPlatformEmailAccount(session.username);

  useEffect(() => {
    if (isLoading || !session.ready) return;
    setReady(true);
  }, [isLoading, session.ready]);

  useEffect(() => {
    if (!ready || isLoading || !user) return;
    if (!allowed) router.replace('/admin/home' as Route);
  }, [ready, isLoading, user, allowed, router]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    fetch('/api/admin/visits', { cache: 'no-store', credentials: 'include', headers: authHeaders() })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          const message = body && typeof body.error === 'string' ? body.error : 'Visits could not be loaded.';
          throw new Error(message);
        }
        return body as VisitSummary;
      })
      .then((body) => {
        if (cancelled) return;
        setSummary(body);
        setError('');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Visits could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  if (isLoading || !ready || !user || !allowed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="admin" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
        <main style={{ flex: 1, padding: 24, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: '0 0 8px' }}>
            <FaChartBar style={{ marginRight: 10 }} aria-hidden />
            Visits
          </h1>
          <p style={{ color: '#9ca3af', margin: '0 0 24px', fontSize: 14, maxWidth: 720 }}>
            Page views on fixtray.app. The visit count is every recorded page. Unique visitors are distinct hashed IP addresses, so people on the same network count as one visitor. The raw IP address is not stored.
          </p>

          {error ? <p style={{ color: '#fca5a5' }}>{error}</p> : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <section style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
              <h2 style={{ margin: 0, color: '#9ca3af', fontSize: 13, fontWeight: 600 }}>Visit count</h2>
              <p style={{ margin: '8px 0 0', color: '#f8fafc', fontSize: 32, fontWeight: 700 }}>
                {summary ? summary.visitCount.toLocaleString() : '…'}
              </p>
            </section>
            <section style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
              <h2 style={{ margin: 0, color: '#9ca3af', fontSize: 13, fontWeight: 600 }}>Unique visitors</h2>
              <p style={{ margin: '8px 0 0', color: '#f8fafc', fontSize: 32, fontWeight: 700 }}>
                {summary ? summary.uniqueVisitors.toLocaleString() : '…'}
              </p>
            </section>
          </div>

          <section style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
            <h2 style={{ fontSize: 16, color: '#e5e7eb', margin: '0 0 12px' }}>Recent pages</h2>
            {summary && summary.recentPages.length === 0 ? (
              <p style={{ color: '#9ca3af', margin: 0 }}>No page views yet.</p>
            ) : null}
            {summary && summary.recentPages.length > 0 ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {summary.recentPages.map((page, index) => (
                  <li
                    key={`${page.createdAt}-${page.path}-${index}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 16,
                      padding: '10px 0',
                      borderTop: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      color: '#e5e7eb',
                      fontSize: 14,
                    }}
                  >
                    <span>
                      <span style={{ fontWeight: 700 }}>{page.path}</span>
                      {page.referrer ? (
                        <span style={{ display: 'block', color: '#9ca3af', fontSize: 12 }}>From {page.referrer}</span>
                      ) : null}
                    </span>
                    <time dateTime={page.createdAt} style={{ color: '#9ca3af', whiteSpace: 'nowrap' }}>{formatWhen(page.createdAt)}</time>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
}
