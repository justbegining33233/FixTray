'use client';

import { useEffect, useState } from 'react';
import { usePhrase } from '@/lib/usePhrase';

type WebhookRow = {
  id: string;
  url: string;
  events: string;
  active: boolean;
};

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export default function WebhooksPage() {
  const say = usePhrase();
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/webhooks', { headers: authHeaders(), credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load webhooks');
      setWebhooks(data.webhooks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createWebhook(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSecret('');
    const response = await fetch('/api/webhooks', {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: JSON.stringify({ url, events: ['workorder.updated'] }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Failed to create webhook');
      return;
    }
    setSecret(data.secret || '');
    setUrl('');
    load();
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 16, color: '#e5e7eb' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{say('Webhooks')}</h1>
      <p style={{ color: '#9aa3b2', marginBottom: 16 }}>{say('HTTPS endpoints this shop notifies when a work order changes.')}</p>
      <form onSubmit={createWebhook} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com/hooks/fixtray"
          aria-label={say('Webhook URL')}
          required
          style={{ flex: '1 1 220px', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
        />
        <button type="submit" style={{ padding: '10px 14px', background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
          {say('Add webhook')}
        </button>
      </form>
      {secret && (
        <p style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 8, padding: 12, wordBreak: 'break-all' }}>
          {say('Signing secret:')} {secret}
        </p>
      )}
      {error && <p style={{ color: '#fca5a5' }}>{say(error)}</p>}
      {loading ? <p style={{ color: '#9aa3b2' }}>{say('Loading...')}</p> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {webhooks.length === 0 && <p style={{ color: '#9aa3b2' }}>{say('No webhooks yet.')}</p>}
          {webhooks.map((hook) => (
            <div key={hook.id} style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontWeight: 700, wordBreak: 'break-all' }}>{hook.url}</div>
              <div style={{ color: '#9aa3b2', fontSize: 13 }}>{hook.events} · {hook.active ? say('Active') : say('Paused')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
