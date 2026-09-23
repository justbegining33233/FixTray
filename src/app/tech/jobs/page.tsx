'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import { unwrapWorkOrders } from '@/lib/workOrderList';
import { filterTechJobs, techJobsHref } from '@/lib/techJobs';
import { FaArrowLeft, FaClipboardList } from 'react-icons/fa';

function TechJobsList() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['tech', 'manager']);
  const searchParams = useSearchParams();
  const view = searchParams?.get('view') === 'history' ? 'history' : 'active';
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    fetch('/api/workorders', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load jobs'))))
      .then((data) => setOrders(unwrapWorkOrders(data)))
      .catch(() => setError('Could not load your jobs.'))
      .finally(() => setLoading(false));
  }, [user]);

  if (isLoading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>{say("Loading...")}</div>;
  }
  if (!user) return null;

  const mine = filterTechJobs(orders, user.id, view);

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', padding: 24 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Link href="/tech/home" style={{ color: '#e5332a', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
          <FaArrowLeft style={{ marginRight: 4 }} /> {say("Back to Dashboard")}{' '}</Link>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '12px 0 8px' }}>
          <FaClipboardList style={{ marginRight: 8 }} />
          {view === 'history' ? say("Job History") : say("Active Jobs")}
        </h1>
        <p style={{ color: '#9aa3b2', marginTop: 0 }}>
          {view === 'history' ? say("Completed work assigned to you.") : say("Open work assigned to you.")}
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <Link href={techJobsHref('active') as any} style={{ padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, background: view === 'active' ? '#e5332a' : 'rgba(255,255,255,0.08)', color: '#fff' }}>{say("Active")}</Link>
          <Link href={techJobsHref('history') as any} style={{ padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, background: view === 'history' ? '#e5332a' : 'rgba(255,255,255,0.08)', color: '#fff' }}>{say("History")}</Link>
        </div>
        {loading ? <div style={{ color: '#9aa3b2' }}>{say("Loading jobs...")}</div> : null}
        {error ? <div style={{ color: '#fca5a5' }}>{say(error)}</div> : null}
        {!loading && !error && mine.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9aa3b2', background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
            {view === 'history' ? say("No completed jobs assigned to you yet.") : say("No open jobs assigned to you yet.")}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {mine.map((order) => (
              <Link key={order.id} href={`/workorders/${order.id}` as any} style={{ display: 'block', textDecoration: 'none', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
                <div style={{ color: '#e5e7eb', fontWeight: 700 }}>
                  {say("WO-")}{String(order.id).slice(-8).toUpperCase()} · {order.issueDescription?.symptoms || order.issueDescription || order.serviceType || say("Service")}
                </div>
                <div style={{ color: '#9aa3b2', fontSize: 13, marginTop: 4 }}>
                  {say(order.status)}{order.customer ? ` · ${order.customer.firstName || ''} ${order.customer.lastName || ''}` : ''}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TechJobsPage() {
  const say = usePhrase();
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>{say("Loading...")}</div>}>
      <TechJobsList />
    </Suspense>
  );
}
