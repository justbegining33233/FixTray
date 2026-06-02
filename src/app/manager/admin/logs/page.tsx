'use client';

import { useEffect, useState } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaClipboardList } from 'react-icons/fa';

interface LogEntry {
  id: string;
  action: string;
  details: string | null;
  performedBy: string | null;
  createdAt: string;
}

export default function ManagerLogsPage() {
  const { user, isLoading } = useRequireAuth(['manager']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      const r = await fetch('/api/shop/logs', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { const d = await r.json(); setLogs(d.logs || d || []); }
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
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: '16px 0 24px' }}><FaClipboardList style={{ marginRight: 8 }} />Audit Logs</h1>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40 }}>Loading...</div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 60, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <FaClipboardList style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
              <p>No audit log entries found.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {logs.map(l => (
                <div key={l.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <span style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 14 }}>{l.action}</span>
                    {l.details && <span style={{ color: '#9aa3b2', fontSize: 13, marginLeft: 8 }}> {l.details}</span>}
                  </div>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>{new Date(l.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

