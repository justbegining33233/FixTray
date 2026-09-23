'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBox, FaWrench } from 'react-icons/fa';

interface PartRow {
  id: string;
  itemName: string;
  sku?: string | null;
  quantity: number;
  unitCost: number;
  sellingPrice: number;
}

interface LaborRow {
  id: string;
  name: string;
  category: string;
  rate: number;
}

export default function PartsLaborPage() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['shop', 'manager']);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [labor, setLabor] = useState<LaborRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', category: 'General', rate: '' });
  const [saving, setSaving] = useState(false);

  const shopId = user?.role === 'shop' ? (user.shopId || user.id) : (user?.shopId || '');

  useEffect(() => {
    if (!user) return;
    if (!shopId) {
      setLoading(false);
      setError('No shop is associated with this account.');
      return;
    }
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    Promise.all([
      fetch(`/api/shop/inventory-stock?shopId=${encodeURIComponent(shopId)}`, { headers }).then((response) => response.ok ? response.json() : { items: [] }),
      fetch(`/api/shops/labor-rates?shopId=${encodeURIComponent(shopId)}`, { headers }).then((response) => response.ok ? response.json() : []),
    ])
      .then(([stock, rates]) => {
        setParts(Array.isArray(stock?.items) ? stock.items : []);
        setLabor(Array.isArray(rates) ? rates : []);
      })
      .catch(() => setError('Could not load parts and labor.'))
      .finally(() => setLoading(false));
  }, [user, shopId]);

  const addLaborRate = async () => {
    const rate = Number(form.rate);
    if (!shopId || !form.name.trim() || !Number.isFinite(rate)) return;
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/shops/labor-rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ shopId, name: form.name.trim(), category: form.category.trim() || 'General', rate }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Could not save labor rate');
      }
      const created = await response.json();
      setLabor((current) => [created, ...current]);
      setForm({ name: '', category: 'General', rate: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save labor rate');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#e5e7eb' }}>{say("Loading parts and labor...")}</div>;
  }
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Link href="/shop/home" style={{ color: '#e5332a', textDecoration: 'none', fontWeight: 700 }}>
          <FaArrowLeft style={{ marginRight: 6 }} /> {say("Shop Home")}{' '}</Link>
        <h1 style={{ fontSize: 32, margin: '12px 0 4px' }}>{say("Parts & Labor")}</h1>
        <p style={{ color: '#9aa3b2', marginTop: 0 }}>{say("Part prices from inventory and the hourly labor rates used on estimates. The service catalog is a separate list of offered services.")}</p>
        {error ? <div style={{ background: '#fde8e8', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 16 }}>{say(error)}</div> : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <section style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0 }}><FaBox /> {say("Parts")}</h2>
            {parts.length === 0 ? <p style={{ color: '#9aa3b2' }}>{say("No parts in inventory yet.")}</p> : (
              <div style={{ display: 'grid', gap: 10 }}>
                {parts.map((part) => (
                  <div key={part.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{say(part.itemName)}</div>
                      <div style={{ color: '#9aa3b2', fontSize: 13 }}>{part.sku || say("No SKU")} {say("· Qty")}{' '}{say(part.quantity)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>${Number(part.sellingPrice || 0).toFixed(2)}</div>
                      <div style={{ color: '#9aa3b2', fontSize: 12 }}>{say("Cost $")}{Number(part.unitCost || 0).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link href="/shop/inventory" style={{ display: 'inline-block', marginTop: 16, color: '#e5332a', fontWeight: 700 }}>{say("Manage inventory")}</Link>
          </section>

          <section style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0 }}><FaWrench /> {say("Labor rates")}</h2>
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={say("Rate name")} style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.25)', color: '#e5e7eb' }} />
              <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder={say("Category")} style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.25)', color: '#e5e7eb' }} />
              <input value={form.rate} onChange={(event) => setForm({ ...form, rate: event.target.value })} placeholder={say("Hourly rate")} type="number" min="0" step="0.01" style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.25)', color: '#e5e7eb' }} />
              <button onClick={addLaborRate} disabled={saving} style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: '#e5332a', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                {saving ? say("Saving…") : say("Add labor rate")}
              </button>
            </div>
            {labor.length === 0 ? <p style={{ color: '#9aa3b2' }}>{say("No labor rates yet.")}</p> : (
              <div style={{ display: 'grid', gap: 10 }}>
                {labor.map((rate) => (
                  <div key={rate.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{say(rate.name)}</div>
                      <div style={{ color: '#9aa3b2', fontSize: 13 }}>{say(rate.category)}</div>
                    </div>
                    <div>${Number(rate.rate || 0).toFixed(2)}/hr</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
