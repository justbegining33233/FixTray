'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaDesktop } from 'react-icons/fa';

interface Session {
  id: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export default function SessionsPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchSessions();
  }, [user]);

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/sessions', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch {}
    finally { setLoading(false); }
  };

  const revokeSession = async (id: string) => {
    if (!confirm('Revoke this session? The device will be logged out.')) return;
    setRevoking(id);
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/sessions?sessionId=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchSessions();
    } catch {}
    finally { setRevoking(null); }
  };

  const revokeAll = async () => {
    if (!confirm('Log out all other sessions?')) return;
    setRevoking('all');
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/sessions?all=true', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchSessions();
    } catch {}
    finally { setRevoking(null); }
  };

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="shop" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
        <main style={{ flex: 1, padding: '24px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <Link href="/shop/settings" style={{ color: '#ff6b64', textDecoration: 'none', fontSize: 14 }}><FaArrowLeft style={{marginRight:4}} /> Settings</Link>
              <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginTop: 4 }}>Active Sessions</h1>
              <p style={{ color: '#9ca3af', fontSize: 14 }}>Manage where you&apos;re logged in</p>
            </div>
            {sessions.length > 1 && (
              <button onClick={revokeAll} disabled={revoking === 'all'}
                style={{ background: '#450a0a', color: '#ef4444', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: revoking === 'all' ? 0.5 : 1 }}>
                Log Out All Others
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #334155' }}>
              <div style={{ color: '#6b7280' }}>No active sessions found</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {sessions.map(session => (
                <div key={session.id} style={{
                  background: '#1e293b', borderRadius: 12, padding: 20,
                  border: session.isCurrent ? '1px solid #16a34a' : '1px solid #334155',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}><FaDesktop style={{marginRight:4}} /></span>
                      <span style={{ color: '#e5e7eb', fontWeight: 600 }}>
                        {session.isCurrent ? 'This Device (Current)' : 'Active Session'}
                      </span>
                      {session.isCurrent && (
                        <span style={{ background: '#052e16', color: '#22c55e', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>Current</span>
                      )}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
                      Created {new Date(session.createdAt).toLocaleString()}  Expires {new Date(session.expiresAt).toLocaleString()}
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <button onClick={() => revokeSession(session.id)} disabled={revoking === session.id}
                      style={{ background: '#374151', color: '#e5e7eb', border: '1px solid #4b5563', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, opacity: revoking === session.id ? 0.5 : 1 }}>
                      {revoking === session.id ? 'Revoking...' : 'Revoke'}
                    </button>
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


