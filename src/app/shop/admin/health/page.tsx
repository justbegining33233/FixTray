'use client';

import { useEffect, useState } from 'react';
import { usePhrase } from '@/lib/usePhrase';
import { useRequireAuth } from '@/contexts/AuthContext';

export default function ShopAdminHealthPage() {
  const say = usePhrase();
  useRequireAuth(['shop']);
  const [shopName, setShopName] = useState('');
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/shops/settings', {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('unavailable');
        const data = await response.json();
        setShopName(data?.shop?.shopName || '');
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 16, color: '#e5e7eb' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{say('Shop Admin Health')}</h1>
      <p style={{ color: '#9aa3b2', marginBottom: 16 }}>{say('Shop settings reachability for this account.')}</p>
      <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{shopName || say('This shop')}</div>
        <div style={{ color: status === 'ok' ? '#86efac' : status === 'error' ? '#fca5a5' : '#9aa3b2' }}>
          {status === 'loading' ? say('Checking...') : status === 'ok' ? say('Settings reachable') : say('Settings unavailable')}
        </div>
      </div>
    </div>
  );
}
