'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaKey } from 'react-icons/fa';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

export default function ApiKeysPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['workorders.read']);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const AVAILABLE_SCOPES = [
    'workorders.read', 'workorders.write',
    'inventory.read', 'inventory.write',
    'customers.read', 'customers.write',
    'techs.read', 'analytics.read',
  ];

  useEffect(() => {
    if (!user) return;
    fetchKeys();
  }, [user]);

  const fetchKeys = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/api-keys', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch {}
    finally { setLoading(false); }
  };

  const createKey = async () => {
    if (!newKeyName.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName, scopes: newKeyScopes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create key');
      setCreatedKey(data.key);
      setShowCreate(false);
      setNewKeyName('');
      fetchKeys();
    } catch (e: any) {
      setError(e.message);
    } finally { setSaving(false); }
  };

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/api-keys?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchKeys();
    } catch {}
  };

  const toggleScope = (scope: string) => {
    setNewKeyScopes(prev => prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]);
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
              <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginTop: 4 }}>API Keys</h1>
              <p style={{ color: '#9ca3af', fontSize: 14 }}>Manage API keys for external integrations</p>
            </div>
            <button onClick={() => { setShowCreate(true); setCreatedKey(null); }}
              style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 }}>
              + New Key
            </button>
          </div>

          {/* Newly Created Key Warning */}
          {createdKey && (
            <div style={{ background: '#052e16', border: '1px solid #16a34a', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ color: '#22c55e', fontWeight: 600, marginBottom: 8 }}><FaKey style={{marginRight:4}} /> API Key Created  -  Copy it now!</div>
              <div style={{ color: '#e5e7eb', fontFamily: 'monospace', fontSize: 14, background: '#000000', padding: 12, borderRadius: 8, wordBreak: 'break-all' }}>
                {createdKey}
              </div>
              <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 8 }}>This key will not be shown again. Store it securely.</div>
            </div>
          )}

          {/* Create Form */}
          {showCreate && (
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, border: '1px solid #334155', marginBottom: 24 }}>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Create API Key</h2>
              {error && <div style={{ color: '#ef4444', marginBottom: 12, fontSize: 14 }}>{error}</div>}
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: '#9ca3af', fontSize: 13, display: 'block', marginBottom: 4 }}>Key Name</label>
                <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="e.g. CRM Integration"
                  style={{ width: '100%', background: '#000000', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', fontSize: 14 }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: '#9ca3af', fontSize: 13, display: 'block', marginBottom: 8 }}>Scopes</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {AVAILABLE_SCOPES.map(scope => (
                    <button key={scope} onClick={() => toggleScope(scope)}
                      style={{
                        padding: '6px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: 'none',
                        background: newKeyScopes.includes(scope) ? '#1d4ed8' : '#000000',
                        color: newKeyScopes.includes(scope) ? '#fff' : '#9ca3af',
                      }}>
                      {scope}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={createKey} disabled={saving}
                  style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.5 : 1 }}>
                  {saving ? 'Creating...' : 'Create Key'}
                </button>
                <button onClick={() => setShowCreate(false)}
                  style={{ background: '#374151', color: '#e5e7eb', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Key List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading keys...</div>
          ) : keys.length === 0 ? (
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #334155' }}>
              <div style={{ color: '#6b7280', fontSize: 16, marginBottom: 8 }}>No API keys yet</div>
              <div style={{ color: '#4b5563', fontSize: 14 }}>Create your first key to enable external integrations</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {keys.map(key => (
                <div key={key.id} style={{ background: '#1e293b', borderRadius: 12, padding: 20, border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 15 }}>{key.name}</div>
                    <div style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: 13, marginTop: 2 }}>{key.prefix}---</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                      {key.scopes.map(s => (
                        <span key={s} style={{ background: '#000000', color: '#ff6b64', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>{s}</span>
                      ))}
                    </div>
                    <div style={{ color: '#4b5563', fontSize: 12, marginTop: 4 }}>
                      Created {new Date(key.createdAt).toLocaleDateString()}
                      {key.lastUsedAt && `  Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                      {key.expiresAt && `  Expires ${new Date(key.expiresAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <button onClick={() => revokeKey(key.id)}
                    style={{ background: '#450a0a', color: '#ef4444', border: '1px solid #7f1d1d', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


