'use client';

import { useEffect, useState } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaClipboardList, FaDollarSign, FaStopwatch, FaWrench } from 'react-icons/fa';

interface WorkOrderTemplate {
  id: string;
  name: string;
  serviceType: string;
  description: string;
  estimatedCost: number;
  laborHours: number;
  createdAt: string;
}

export default function ManagerTemplatesPage() {
  const { user, isLoading } = useRequireAuth(['manager']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [templates, setTemplates] = useState<WorkOrderTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      const r = await fetch('/api/shop/templates', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { const d = await r.json(); setTemplates(d.templates || d || []); }
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
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: '16px 0 24px' }}>Work Order Templates</h1>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40 }}>Loading...</div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 60, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <FaClipboardList style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
              <p>No templates created yet.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {templates.map(t => (
                <div key={t.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
                  <h3 style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 16, marginBottom: 8 }}><FaWrench style={{ marginRight: 6, color: '#e5332a' }} />{t.name}</h3>
                  <p style={{ color: '#9aa3b2', fontSize: 13, marginBottom: 8 }}>{t.description || t.serviceType}</p>
                  <div style={{ display: 'flex', gap: 16, color: '#6b7280', fontSize: 13 }}>
                    <span><FaDollarSign /> ${t.estimatedCost?.toFixed(2) || '0.00'}</span>
                    <span><FaStopwatch /> {t.laborHours || 0}h</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


