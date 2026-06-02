'use client';

import { useEffect, useState } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaCalendarAlt, FaSyncAlt } from 'react-icons/fa';

interface RecurringSchedule {
  id: string;
  title: string;
  issueDescription: string;
  frequency: string;
  nextRunAt: string;
  lastRunAt: string | null;
  active: boolean;
  customer: { firstName: string; lastName: string };
  vehicle: { make: string; model: string; year: number } | null;
}

const FREQ_LABELS: Record<string, string> = { weekly: 'Weekly', biweekly: 'Bi-weekly', monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually' };

export default function ManagerRecurringWorkOrdersPage() {
  const { user, isLoading } = useRequireAuth(['manager']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [items, setItems] = useState<RecurringSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      const r = await fetch('/api/recurring-workorders', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { const d = await r.json(); setItems(d.schedules || d || []); }
      setLoading(false);
    };
    load();
  }, [user]);

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="manager" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(o => !o)} showMenuButton />
        <main style={{ flex: 1, padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <Breadcrumbs />
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: '16px 0 24px' }}>Recurring Work Orders</h1>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40 }}>Loading...</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 60, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <FaSyncAlt style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
              <p>No recurring work orders set up.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map(r => (
                <div key={r.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ background: r.active ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)', color: r.active ? '#22c55e' : '#9ca3af', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, marginRight: 8 }}>{r.active ? 'Active' : 'Paused'}</span>
                      <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{r.title}</span>
                    </div>
                    <span style={{ color: '#9aa3b2', fontSize: 13 }}><FaSyncAlt style={{ marginRight: 4 }} />{FREQ_LABELS[r.frequency] || r.frequency}</span>
                  </div>
                  <p style={{ color: '#9aa3b2', fontSize: 13, marginTop: 8 }}>{r.customer.firstName} {r.customer.lastName} {r.vehicle ? ` ${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}` : ''}</p>
                  <p style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}><FaCalendarAlt style={{ marginRight: 4 }} />Next: {new Date(r.nextRunAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

