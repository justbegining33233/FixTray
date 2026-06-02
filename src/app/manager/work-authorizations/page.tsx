'use client';

import { useState, useEffect } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaCheckCircle, FaHourglassHalf, FaLink, FaPencilAlt } from 'react-icons/fa';

interface WorkAuthorization {
  id: string;
  token: string;
  status: string;
  workSummary: string;
  estimateTotal?: number;
  expiresAt?: string;
  signerName?: string;
  signedAt?: string;
  declinedAt?: string;
  createdAt: string;
  workOrderId?: string;
}

const statusColor: Record<string, { bg: string; color: string; text: string }> = {
  pending:  { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', text: 'Pending' },
  signed:   { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', text: 'Signed' },
  declined: { bg: 'rgba(229,51,42,0.15)',  color: '#e5332a', text: 'Declined' },
  expired:  { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af', text: 'Expired' },
};

export default function ManagerWorkAuthorizationsPage() {
  const { user, isLoading } = useRequireAuth(['manager']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [auths, setAuths] = useState<WorkAuthorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');

  const load = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/work-authorizations', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setAuths(await r.json());
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const getStatus = (a: WorkAuthorization) => {
    if (a.status === 'signed') return 'signed';
    if (a.status === 'declined') return 'declined';
    if (a.expiresAt && new Date(a.expiresAt) < new Date()) return 'expired';
    return 'pending';
  };

  const copyLink = (authToken: string) => {
    const url = `${window.location.origin}/customer/authorization/${authToken}`;
    navigator.clipboard.writeText(url);
    setCopied(authToken);
    setTimeout(() => setCopied(''), 2000);
  };

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="manager" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(o => !o)} showMenuButton />
        <main style={{ flex: 1, padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <Breadcrumbs />
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: '16px 0 24px' }}>Work Authorizations</h1>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40 }}>Loading...</div>
          ) : auths.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 60, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <FaPencilAlt style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
              <p>No work authorizations yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {auths.map(a => {
                const s = getStatus(a);
                const sc = statusColor[s];
                return (
                  <div key={a.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <span style={{ background: sc.bg, color: sc.color, padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, marginRight: 8 }}>
                          {s === 'signed' ? <FaCheckCircle style={{ marginRight: 4 }} /> : <FaHourglassHalf style={{ marginRight: 4 }} />}
                          {sc.text}
                        </span>
                        <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{a.workSummary}</span>
                      </div>
                      <button onClick={() => copyLink(a.token)} style={{ background: 'rgba(229,51,42,0.15)', color: '#e5332a', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>
                        <FaLink style={{ marginRight: 4 }} />{copied === a.token ? 'Copied!' : 'Copy Link'}
                      </button>
                    </div>
                    {a.estimateTotal && <p style={{ color: '#9aa3b2', fontSize: 14, marginTop: 8 }}>Estimate: ${a.estimateTotal.toFixed(2)}</p>}
                    <p style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>Created {new Date(a.createdAt).toLocaleDateString()}</p>
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


