'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { unwrapWorkOrders } from '@/lib/workOrderList';
import { filterTechJobs, techJobsHref } from '@/lib/techJobs';
import { workOrderTitle } from '@/lib/workOrderMetrics';
import { FaArrowLeft, FaClipboardList } from 'react-icons/fa';

function TechWorkOrders() {
  const { user, isLoading } = useRequireAuth(['tech', 'manager']);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    fetch('/api/workorders?limit=100', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load work orders'))))
      .then((data) => setOrders(unwrapWorkOrders(data)))
      .catch(() => setError('Could not load work orders.'))
      .finally(() => setLoading(false));
  }, [user]);

  if (isLoading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  }
  if (!user) return null;

  const mine = filterTechJobs(orders, user.id, 'active');

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', padding: 24 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Link href="/tech/home" style={{ color: '#e5332a', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
          <FaArrowLeft style={{ marginRight: 4 }} /> Back to Dashboard
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '12px 0 8px' }}>
          <FaClipboardList style={{ marginRight: 8 }} />
          Work Orders
        </h1>
        <p style={{ color: '#9aa3b2', marginTop: 0 }}>Open work orders assigned to you.</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <Link href="/tech/work-orders" style={{ padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, background: '#e5332a', color: '#fff' }}>Work Orders</Link>
          <Link href={techJobsHref('history') as any} style={{ padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, background: 'rgba(255,255,255,0.08)', color: '#fff' }}>History</Link>
        </div>
        {loading ? <div style={{ color: '#9aa3b2' }}>Loading work orders...</div> : null}
        {error ? <div style={{ color: '#fca5a5' }}>{error}</div> : null}
        {!loading && !error && mine.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9aa3b2', background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
            No open work orders assigned to you yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {mine.map((order) => (
              <Link key={order.id} href={`/workorders/${order.id}` as any} style={{ display: 'block', textDecoration: 'none', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
                <div style={{ color: '#e5e7eb', fontWeight: 700 }}>
                  WO-{String(order.id).slice(-8).toUpperCase()} · {workOrderTitle(order)}
                </div>
                <div style={{ color: '#9aa3b2', fontSize: 13, marginTop: 4 }}>
                  {order.status}{order.customer ? ` · ${order.customer.firstName || ''} ${order.customer.lastName || ''}` : ''}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TechWorkOrdersPage() {
  return (
    <Suspense fallback={<div style={{ color: '#e5e7eb', padding: 24 }}>Loading...</div>}>
      <TechWorkOrders />
    </Suspense>
  );
}
