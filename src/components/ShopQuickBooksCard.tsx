'use client';

import { useEffect, useState } from 'react';
import { FaChartBar } from 'react-icons/fa';

/**
 * Shop-owner connect card. OAuth is the QuickBooks path.
 * Intuit client id and secret are never collected here.
 */
export default function ShopQuickBooksCard({ readOnly = false }: { readOnly?: boolean }) {
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [realmId, setRealmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/shop/quickbooks/status', {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (response) => {
        if (!response.ok) return;
        const body = await response.json();
        setConnected(body.connected === true);
        setConfigured(body.configured === true);
        setRealmId(typeof body.realmId === 'string' ? body.realmId : null);
      })
      .catch(() => setError('Could not load QuickBooks Online'));
  }, []);

  const connect = async () => {
    setBusy(true);
    setError('');
    const token = localStorage.getItem('token');
    const response = await fetch('/api/shop/quickbooks/connect', {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || typeof body.url !== 'string') {
      const missing = Array.isArray(body.missing) ? ` Missing ${body.missing.join(', ')}.` : '';
      setError((body.error || 'Could not start QuickBooks Online') + missing);
      setBusy(false);
      return;
    }
    window.location.href = body.url;
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(44,160,28,0.45)', borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ width: 44, height: 44, background: 'rgba(44,160,28,0.18)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: '1px solid rgba(44,160,28,0.35)', color: '#86efac' }}>
          <FaChartBar />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>QuickBooks Online</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            {configured === false ? 'QuickBooks Online is not configured' : connected ? `Connected${realmId ? ` · ${realmId}` : ''}` : 'Not connected'}
          </div>
        </div>
      </div>
      <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 12px', lineHeight: 1.5 }}>
        Connect once with QuickBooks Online. Shop Books syncs sales, payments, refunds, and labor. The FixTray fee is not a shop expense.
      </p>
      {error && <p style={{ color: '#fca5a5', fontSize: 13 }}>{error}</p>}
      <button
        type="button"
        onClick={connect}
        disabled={busy || readOnly || configured !== true}
        style={{ width: '100%', background: configured !== true || readOnly ? '#374151' : '#2CA01C', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 700, cursor: busy || readOnly || configured !== true ? 'not-allowed' : 'pointer' }}
      >
        {configured === false ? 'QuickBooks Online is not configured' : busy ? '...' : connected ? 'Reconnect QuickBooks Online' : 'Connect QuickBooks Online'}
      </button>
    </div>
  );
}
