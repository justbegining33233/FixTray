'use client';

import { useEffect, useState } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { money, pageStyle } from '@/components/books/drillChrome';

export default function SalesTaxPage() {
  const { user, isLoading } = useRequireAuth(['shop', 'accountant']);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [ratePercent, setRatePercent] = useState('0');
  const [laborTaxable, setLaborTaxable] = useState(false);
  const [partsTaxable, setPartsTaxable] = useState(false);
  const [taxCents, setTaxCents] = useState(0);
  const [taxableCents, setTaxableCents] = useState(0);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || from) return;
    const token = localStorage.getItem('token');
    fetch('/api/shop/eod-report', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const day = typeof body?.date === 'string' ? body.date : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
        setTo(day);
        setFrom(`${day.slice(0, 8)}01`);
      })
      .catch(() => {});
  }, [user, from]);

  useEffect(() => {
    if (!user || !from || !to) return;
    const token = localStorage.getItem('token');
    fetch(`/api/shop/accounting/tax?from=${from}&to=${to}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(body?.error || 'Could not load sales tax');
          return;
        }
        setRatePercent(String(body.settings?.ratePercent ?? 0));
        setLaborTaxable(body.settings?.laborTaxable === true);
        setPartsTaxable(body.settings?.partsTaxable === true);
        setTaxCents(body.taxCents || 0);
        setTaxableCents(body.taxableCents || 0);
        setNote(body.note || '');
      })
      .catch(() => setError('Could not load sales tax'));
  }, [user, from, to]);

  const save = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/shop/accounting/tax', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ratePercent: Number(ratePercent), laborTaxable, partsTaxable }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) setError(body?.error || 'Could not save tax settings');
  };

  if (isLoading || !user) return null;
  const readOnly = user.role === 'accountant';

  return (
    <div style={pageStyle}>
      <h1 style={{ marginTop: 0 }}>Sales tax</h1>
      <p style={{ color: '#c4a8a4' }}>{note || 'No sales tax until you set a rate. FixTray does not invent a jurisdiction.'}</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      {error ? <p>{error}</p> : null}
      <p>Taxable {money(taxableCents)}. Tax {money(taxCents)}.</p>
      {readOnly ? <p>Read only. The shop owner sets the rate.</p> : (
        <div style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
          <label>Rate percent <input value={ratePercent} onChange={(event) => setRatePercent(event.target.value)} /></label>
          <label><input type="checkbox" checked={laborTaxable} onChange={(event) => setLaborTaxable(event.target.checked)} /> Labor is taxable</label>
          <label><input type="checkbox" checked={partsTaxable} onChange={(event) => setPartsTaxable(event.target.checked)} /> Parts are taxable</label>
          <button type="button" onClick={save}>Save tax settings</button>
        </div>
      )}
    </div>
  );
}
