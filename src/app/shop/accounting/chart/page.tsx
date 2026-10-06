'use client';

import { useEffect, useState } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { DEFAULT_SHOP_ACCOUNTS } from '@/lib/books/journal';
import { pageStyle } from '@/components/books/drillChrome';

const MAP_FIELDS = [
  ['sales', 'Sales'],
  ['payments', 'Payments'],
  ['refunds', 'Refunds'],
  ['labor', 'Labor'],
  ['parts', 'Parts'],
  ['tax', 'Sales tax'],
] as const;

export default function ChartOfAccountsPage() {
  const { user, isLoading } = useRequireAuth(['shop', 'accountant']);
  const [map, setMap] = useState<Record<string, string>>({});
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    fetch('/api/shop/quickbooks/status', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (res) => {
        if (!res.ok) return;
        const body = await res.json();
        setConfigured(body.configured === true);
        if (body.qbMap && typeof body.qbMap === 'object') setMap(body.qbMap);
      })
      .catch(() => setError('Could not load the QuickBooks map'));
  }, [user]);

  const save = async () => {
    setError('');
    setNotice('');
    const token = localStorage.getItem('token');
    const res = await fetch('/api/shop/quickbooks/map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ map }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || 'Could not save the map');
      return;
    }
    setNotice('QuickBooks map saved. The FixTray fee is not a shop account.');
  };

  if (isLoading || !user) return null;
  const readOnly = user.role !== 'shop';

  return (
    <div style={pageStyle}>
      <h1 style={{ marginTop: 0 }}>Chart of Accounts</h1>
      <p style={{ color: '#c4a8a4' }}>Shop accounts only. The FixTray fee is not an account and is not mapped to QuickBooks.</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Code</th>
            <th style={{ textAlign: 'left' }}>Account</th>
            <th style={{ textAlign: 'left' }}>Type</th>
          </tr>
        </thead>
        <tbody>
          {DEFAULT_SHOP_ACCOUNTS.map((account) => (
            <tr key={account.systemKey}>
              <td>{account.code}</td>
              <td>{account.name}</td>
              <td>{account.accountType}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Map to QuickBooks</h2>
      {configured === false ? <p>QuickBooks Online is not configured. You can still save the map for when it is.</p> : null}
      {MAP_FIELDS.map(([key, label]) => (
        <label key={key} style={{ display: 'block', marginBottom: 8 }}>
          {label}{' '}
          <input
            value={map[key] || ''}
            disabled={readOnly}
            onChange={(event) => setMap({ ...map, [key]: event.target.value })}
          />
        </label>
      ))}
      {error ? <p style={{ color: '#fca5a5' }}>{error}</p> : null}
      {notice ? <p style={{ color: '#86efac' }}>{notice}</p> : null}
      {readOnly ? <p style={{ color: '#c4a8a4' }}>Read only.</p> : (
        <button type="button" onClick={save}>Save QuickBooks map</button>
      )}
    </div>
  );
}
