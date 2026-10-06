'use client';

import { useEffect, useState } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { money, pageStyle } from '@/components/books/drillChrome';

interface ProductivityRow {
  personId: string;
  clockedMinutes: number;
  billedMinutes: number;
}

interface TechRevenue {
  techId: string;
  revenueCents: number;
}

export default function TechProductivityPage() {
  const { user, isLoading } = useRequireAuth(['shop', 'accountant']);
  const [rows, setRows] = useState<ProductivityRow[]>([]);
  const [revenue, setRevenue] = useState<TechRevenue[]>([]);
  const [basis, setBasis] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    fetch('/api/profit-margins?days=30', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(body?.error || 'Could not load tech productivity');
          return;
        }
        setRows(Array.isArray(body.productivity) ? body.productivity : []);
        setRevenue(Array.isArray(body.techRevenue) ? body.techRevenue : []);
        setBasis(typeof body.basis === 'string' ? body.basis : '');
      })
      .catch(() => setError('Could not load tech productivity'));
  }, [user]);

  if (isLoading || !user) return null;
  const revenueByTech = new Map(revenue.map((row) => [row.techId, row.revenueCents]));

  return (
    <div style={pageStyle}>
      <h1 style={{ marginTop: 0 }}>Tech Productivity</h1>
      <p style={{ color: '#c4a8a4' }}>Hours clocked against hours billed. Revenue is shop payments on that tech&apos;s jobs. {basis}</p>
      {error ? <p>{error}</p> : null}
      {user.role === 'accountant' ? <p style={{ color: '#c4a8a4' }}>Read only.</p> : null}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Tech</th>
            <th>Clocked hours</th>
            <th>Billed hours</th>
            <th>Shop revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.personId}>
              <td>{row.personId}</td>
              <td>{(row.clockedMinutes / 60).toFixed(1)}</td>
              <td>{(row.billedMinutes / 60).toFixed(1)}</td>
              <td>{money(revenueByTech.get(row.personId) || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p>No clock or billed time in the last 30 days.</p> : null}
    </div>
  );
}
