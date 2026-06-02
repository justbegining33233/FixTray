'use client';

import { useState, useEffect } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaClipboardCheck, FaSearch, FaCar } from 'react-icons/fa';

interface Inspection {
  id: string;
  vehicleInfo: string;
  status: string;
  date: string;
  inspector: string;
  notes?: string;
}

export default function ManagerInspectionsPage() {
  const { user, isLoading } = useRequireAuth(['manager']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      try {
        const res = await fetch('/api/inspections', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setInspections(data.inspections || data || []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [user]);

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  const filtered = inspections
    .filter(i => filter === 'all' || i.status === filter)
    .filter(i => !search || i.vehicleInfo.toLowerCase().includes(search.toLowerCase()) || i.inspector.toLowerCase().includes(search.toLowerCase()));

  const statusColor = (s: string) => {
    switch (s.toLowerCase()) {
      case 'passed': return '#22c55e';
      case 'failed': return '#ef4444';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="manager" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(o => !o)} showMenuButton />
        <main style={{ flex: 1, padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <Breadcrumbs />
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: '16px 0 24px' }}><FaClipboardCheck style={{ marginRight: 8 }} />Vehicle Inspections</h1>

          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input
                type="text"
                placeholder="Search inspections..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '10px 10px 10px 36px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e5e7eb', fontSize: 14 }}
              />
            </div>
            {['all', 'passed', 'failed', 'pending'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '10px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  background: filter === f ? '#e5332a' : 'rgba(0,0,0,0.3)',
                  color: filter === f ? '#fff' : '#9aa3b2',
                  border: filter === f ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  textTransform: 'capitalize',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40 }}>Loading inspections...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>
              <FaCar style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
              <p style={{ fontSize: 18 }}>No inspections found</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(ins => (
                <div key={ins.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 16 }}>{ins.vehicleInfo}</div>
                    <div style={{ color: '#9aa3b2', fontSize: 13, marginTop: 4 }}>Inspector: {ins.inspector} &bull; {new Date(ins.date).toLocaleDateString()}</div>
                    {ins.notes && <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>{ins.notes}</div>}
                  </div>
                  <span style={{ color: statusColor(ins.status), fontWeight: 600, fontSize: 14, textTransform: 'capitalize' }}>{ins.status}</span>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


