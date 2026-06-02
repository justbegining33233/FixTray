'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import Link from 'next/link';
import type { Route } from 'next';
import { FaCheckCircle, FaEye } from 'react-icons/fa';

interface Approval {
  id: string;
  title: string;
  customerName: string;
  estimatedCost: number;
  status: string;
  createdAt: string;
  priority: string;
}

const priorityStyle: Record<string, { bg: string; color: string }> = {
  urgent: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  high:   { bg: 'rgba(249,115,22,0.15)', color: '#f97316' },
  medium: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  low:    { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e' },
};

export default function ManagerApprovalsPage() {
  const { user, isLoading } = useRequireAuth(['manager']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/workorders?status=pending_approval,estimate_sent', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        const items = (json.workOrders ?? json ?? []).map(
          (wo: { id: string; title?: string; issueDescription?: string; customerName?: string; customer?: { name: string }; estimatedCost?: number; status: string; createdAt: string; priority?: string }) => ({
            id: wo.id,
            title: wo.title || wo.issueDescription || 'Work Order',
            customerName: wo.customerName || wo.customer?.name || 'Unknown',
            estimatedCost: wo.estimatedCost || 0,
            status: wo.status,
            createdAt: wo.createdAt,
            priority: wo.priority || 'medium',
          })
        );
        setApprovals(items);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) fetchApprovals(); }, [user, fetchApprovals]);

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  const filtered = filter === 'all' ? approvals : approvals.filter(a => a.status === 'pending_approval' || a.status === 'estimate_sent');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="manager" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(o => !o)} showMenuButton />
        <main style={{ flex: 1, padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <Breadcrumbs />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 24px', flexWrap: 'wrap', gap: 12 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb' }}>Pending Approvals</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['pending', 'all'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize',
                  background: filter === f ? '#e5332a' : 'rgba(0,0,0,0.3)',
                  color: filter === f ? '#fff' : '#9aa3b2',
                  border: filter === f ? 'none' : '1px solid rgba(255,255,255,0.1)',
                }}>{f}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40 }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 60, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <FaCheckCircle style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
              <p>No pending approvals</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(a => {
                const ps = priorityStyle[a.priority] || { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' };
                return (
                  <div key={a.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 16 }}>{a.title}</span>
                        <span style={{ background: ps.bg, color: ps.color, padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{a.priority}</span>
                      </div>
                      <p style={{ color: '#9aa3b2', fontSize: 13 }}>{a.customerName} &bull; Est. ${a.estimatedCost.toLocaleString()} &bull; {new Date(a.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Link href={`/workorders/${a.id}` as Route} style={{ background: 'rgba(229,51,42,0.15)', color: '#e5332a', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 8, padding: '6px 14px', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <FaEye /> View
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


