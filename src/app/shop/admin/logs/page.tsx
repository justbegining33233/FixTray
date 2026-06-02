'use client';

import { useEffect, useState } from 'react';
import { FaArrowLeft, FaClipboardList, FaLock } from 'react-icons/fa';
import Link from 'next/link';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';

interface LogEntry {
  id: string;
  action: string;
  details: string | null;
  performedBy: string | null;
  createdAt: string;
  shopId?: string;
  userId?: string;
}

export default function ShopLogsPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [logType, setLogType] = useState<'audit' | 'activity'>('audit');

  useEffect(() => {
    if (!user) return;
    fetchLogs();
  }, [user, logType]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/shop/logs?type=${logType}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {}
    finally { setLoading(false); }
  };

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="shop" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
        <main style={{ flex: 1, padding: '24px', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <Link href="/shop/admin" style={{ color: '#ff6b64', textDecoration: 'none', fontSize: 14 }}><FaArrowLeft style={{marginRight:4}} /> Admin</Link>
              <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginTop: 4 }}>Shop Logs</h1>
              <p style={{ color: '#9ca3af', fontSize: 14 }}>Audit trail and activity history</p>
            </div>
            <div style={{ display: 'flex', gap: 4, background: '#000000', borderRadius: 8, padding: 2 }}>
              {(['audit', 'activity'] as const).map(type => (
                <button key={type} onClick={() => setLogType(type)}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    background: logType === type ? '#e5332a' : 'transparent',
                    color: logType === type ? '#fff' : '#9ca3af',
                  }}>
                  {type === 'audit' ? <><FaLock style={{marginRight:6, verticalAlign:'middle'}} /> Audit</> : <><FaClipboardList style={{marginRight:6, verticalAlign:'middle'}} /> Activity</>}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading logs...</div>
          ) : logs.length === 0 ? (
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #334155' }}>
              <div style={{ color: '#6b7280' }}>No {logType} logs found</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {logs.map(log => (
                <div key={log.id} style={{ background: '#1e293b', borderRadius: 10, padding: '16px 20px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 14 }}>{log.action}</span>
                      {log.performedBy && (
                        <span style={{ color: '#6b7280', fontSize: 13, marginLeft: 8 }}>by {log.performedBy}</span>
                      )}
                    </div>
                    <span style={{ color: '#4b5563', fontSize: 12 }}>{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  {log.details && (
                    <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>{log.details}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}



