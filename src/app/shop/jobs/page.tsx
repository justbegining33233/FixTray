'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FaArrowLeft, FaClipboardList } from 'react-icons/fa';
import { useRequireAuth } from '@/contexts/AuthContext';
import { usePhrase } from '@/lib/usePhrase';
import { isClosedJobStatus } from '@/lib/techJobs';
import { unwrapWorkOrders, workOrderDetailPath } from '@/lib/workOrderList';
import { workOrderTitle } from '@/lib/workOrderMetrics';

type ShopJob = {
  id: string;
  status?: string;
  vehicleType?: string;
  serviceType?: string;
  issueDescription?: unknown;
  createdAt?: string;
  customer?: { firstName?: string; lastName?: string } | null;
};

function customerLabel(job: ShopJob): string {
  const name = `${job.customer?.firstName || ''} ${job.customer?.lastName || ''}`.trim();
  return name || 'Walk-in';
}

export default function ShopJobsPage() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['shop']);
  const [orders, setOrders] = useState<ShopJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'active' | 'history'>('active');

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    fetch('/api/workorders?limit=100', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load jobs'))))
      .then((data) => setOrders(unwrapWorkOrders(data) as ShopJob[]))
      .catch(() => setError('Could not load work orders.'))
      .finally(() => setLoading(false));
  }, [user]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>
        {say('Loading...')}
      </div>
    );
  }
  if (!user) return null;

  const visible = orders.filter((order) => (view === 'history' ? isClosedJobStatus(order.status) : !isClosedJobStatus(order.status)));

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', padding: 24 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Link href="/shop/home" style={{ color: '#e5332a', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
          <FaArrowLeft style={{ marginRight: 4 }} /> {say('Back to Dashboard')}
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '12px 0 8px' }}>
          <FaClipboardList style={{ marginRight: 8 }} />
          {say('Jobs')}
        </h1>
        <p style={{ color: '#9aa3b2', marginTop: 0 }}>
          {view === 'history' ? say('Completed and closed work orders.') : say('Open work orders for this shop.')}
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => setView('active')}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', fontWeight: 700, cursor: 'pointer', background: view === 'active' ? '#e5332a' : 'rgba(255,255,255,0.08)', color: '#fff' }}
          >
            {say('Active')}
          </button>
          <button
            type="button"
            onClick={() => setView('history')}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', fontWeight: 700, cursor: 'pointer', background: view === 'history' ? '#e5332a' : 'rgba(255,255,255,0.08)', color: '#fff' }}
          >
            {say('History')}
          </button>
        </div>
        {loading ? <div style={{ color: '#9aa3b2' }}>{say('Loading jobs...')}</div> : null}
        {error ? <div style={{ color: '#fca5a5' }}>{say(error)}</div> : null}
        {!loading && !error && visible.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9aa3b2', background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
            {view === 'history' ? say('No completed work orders yet.') : say('No open work orders yet.')}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {visible.map((order) => (
              <Link
                key={order.id}
                href={workOrderDetailPath(order.id) as never}
                style={{ display: 'block', textDecoration: 'none', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}
              >
                <div style={{ color: '#e5e7eb', fontWeight: 700 }}>
                  {say('WO-')}{String(order.id).slice(-8).toUpperCase()} · {workOrderTitle(order)}
                </div>
                <div style={{ color: '#9aa3b2', fontSize: 13, marginTop: 4 }}>
                  {order.status || say('Open')} · {customerLabel(order)}
                  {order.vehicleType ? ` · ${order.vehicleType}` : ''}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
