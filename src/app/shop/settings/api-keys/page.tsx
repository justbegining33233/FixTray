'use client';

import { useEffect, useState } from 'react';
import { usePhrase } from '@/lib/usePhrase';
import { useRequireAuth } from '@/contexts/AuthContext';

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string;
  createdAt: string;
};

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export default function ApiKeysPage() {
  const say = usePhrase();
  useRequireAuth(['shop']);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [name, setName] = useState('');
  const [freshKey, setFreshKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/api-keys', { headers: authHeaders(), credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load API keys');
      setKeys(data.keys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createKey(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setFreshKey('');
    const response = await fetch('/api/api-keys', {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: JSON.stringify({ name, scopes: 'read' }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Failed to create key');
      return;
    }
    setFreshKey(data.key || '');
    setName('');
    load();
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 16, color: '#e5e7eb' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{say('API Keys')}</h1>
      <p style={{ color: '#9aa3b2', marginBottom: 16 }}>{say('Keys for this shop. A new key is shown once.')}</p>
      <form onSubmit={createKey} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={say('Key name')}
          aria-label={say('Key name')}
          required
          style={{ flex: '1 1 180px', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
        />
        <button type="submit" style={{ padding: '10px 14px', background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
          {say('Create key')}
        </button>
      </form>
      {freshKey && (
        <p style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 8, padding: 12, wordBreak: 'break-all' }}>
          {say('Save this key:')} {freshKey}
        </p>
      )}
      {error && <p style={{ color: '#fca5a5' }}>{say(error)}</p>}
      {loading ? <p style={{ color: '#9aa3b2' }}>{say('Loading...')}</p> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {keys.length === 0 && <p style={{ color: '#9aa3b2' }}>{say('No API keys yet.')}</p>}
          {keys.map((key) => (
            <div key={key.id} style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontWeight: 700 }}>{say(key.name)}</div>
              <div style={{ color: '#9aa3b2', fontSize: 13 }}>{key.prefix}… · {key.scopes}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
