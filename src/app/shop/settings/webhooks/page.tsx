'use client';
import { FaArrowLeft } from 'react-icons/fa';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  failureCount: number;
  createdAt: string;
}

const ALL_EVENTS = [
  'workorder.created', 'workorder.updated', 'workorder.closed',
  'payment.received', 'appointment.created', 'appointment.cancelled',
  'inventory.low_stock', 'tech.clocked_in', 'tech.clocked_out',
  'estimate.ready', 'customer.created', '*',
];

export default function WebhooksPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['*']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchWebhooks();
  }, [user]);

  const fetchWebhooks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/webhooks', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.webhooks || []);
      }
    } catch {}
    finally { setLoading(false); }
  };

  const createWebhook = async () => {
    if (!url.trim()) { setError('URL is required'); return; }
    try { new URL(url); } catch { setError('Invalid URL'); return; }
    if (selectedEvents.length === 0) { setError('Select at least one event'); return; }
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, events: selectedEvents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create webhook');
      setShowCreate(false);
      setUrl('');
      setSelectedEvents(['*']);
      fetchWebhooks();
    } catch (e: any) {
      setError(e.message);
    } finally { setSaving(false); }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/webhooks?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      fetchWebhooks();
    } catch {}
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]);
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
              <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginTop: 4 }}>Webhooks</h1>
              <p style={{ color: '#9ca3af', fontSize: 14 }}>Send real-time event notifications to external services</p>
            </div>
            <button onClick={() => setShowCreate(true)}
              style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 }}>
              + New Webhook
            </button>
          </div>

          {/* Create Form */}
          {showCreate && (
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, border: '1px solid #334155', marginBottom: 24 }}>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Create Webhook</h2>
              {error && <div style={{ color: '#ef4444', marginBottom: 12, fontSize: 14 }}>{error}</div>}
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: '#9ca3af', fontSize: 13, display: 'block', marginBottom: 4 }}>Endpoint URL</label>
                <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/webhook"
                  style={{ width: '100%', background: '#000000', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', fontSize: 14 }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: '#9ca3af', fontSize: 13, display: 'block', marginBottom: 8 }}>Events</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ALL_EVENTS.map(event => (
                    <button key={event} onClick={() => toggleEvent(event)}
                      style={{
                        padding: '6px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: 'none',
                        background: selectedEvents.includes(event) ? '#1d4ed8' : '#000000',
                        color: selectedEvents.includes(event) ? '#fff' : '#9ca3af',
                      }}>
                      {event === '*' ? ' All Events' : event}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={createWebhook} disabled={saving}
                  style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.5 : 1 }}>
                  {saving ? 'Creating...' : 'Create Webhook'}
                </button>
                <button onClick={() => setShowCreate(false)}
                  style={{ background: '#374151', color: '#e5e7eb', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Webhook List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading webhooks...</div>
          ) : webhooks.length === 0 ? (
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #334155' }}>
              <div style={{ color: '#6b7280', fontSize: 16, marginBottom: 6 }}>No webhooks configured</div>
              <div style={{ color: '#4b5563', fontSize: 14 }}>Add a webhook to send real-time events to your systems</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {webhooks.map(wh => (
                <div key={wh.id} style={{ background: '#1e293b', borderRadius: 12, padding: 20, border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: wh.active ? '#22c55e' : '#ef4444',
                        }} />
                        <span style={{ color: '#e5e7eb', fontFamily: 'monospace', fontSize: 14, wordBreak: 'break-all' }}>{wh.url}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                        {wh.events.map(e => (
                          <span key={e} style={{ background: '#000000', color: '#ff6b64', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>
                            {e === '*' ? 'All Events' : e}
                          </span>
                        ))}
                      </div>
                      <div style={{ color: '#4b5563', fontSize: 12, marginTop: 6 }}>
                        Created {new Date(wh.createdAt).toLocaleDateString()}
                        {wh.failureCount > 0 && (
                          <span style={{ color: '#ef4444', marginLeft: 8 }}>({wh.failureCount} failures)</span>
                        )}
                        {!wh.active && <span style={{ color: '#ef4444', marginLeft: 8 }}>Disabled</span>}
                      </div>
                    </div>
                    <button onClick={() => deleteWebhook(wh.id)}
                      style={{ background: '#450a0a', color: '#ef4444', border: '1px solid #7f1d1d', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      Delete
                    </button>
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


