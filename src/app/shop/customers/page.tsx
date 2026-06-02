'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';

interface Customer {
  id: string;
  name: string;
  email: string;
}

export default function ShopCustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    fetch('/api/customers', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => setCustomers(data.customers ?? []))
      .catch(() => setError('Failed to load customers'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: 28, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Customer Directory</h1>
          <p style={{ color: '#94a3b8', marginTop: 4, fontSize: 14 }}>All customers who have had service at your shop</p>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search by name or email…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', fontSize: 14, marginBottom: 20, boxSizing: 'border-box',
        }}
      />

      {loading && <p style={{ color: '#94a3b8' }}>Loading customers…</p>}
      {error && <p style={{ color: '#f87171' }}>{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{search ? 'No customers match your search' : 'No customers yet'}</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            {search ? 'Try a different name or email' : 'Customers will appear here once they have a work order'}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(c => (
          <div
            key={c.id}
            onClick={() => router.push(`/shop/customers/${c.id}/crm` as Route)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', background: 'rgba(229,51,42,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: '#e5332a', flexShrink: 0,
              }}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 15 }}>{c.name}</div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>{c.email}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>View Profile →</div>
          </div>
        ))}
      </div>
    </div>
  );
}
