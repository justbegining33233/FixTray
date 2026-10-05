'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import { useSessionUsername } from '@/lib/useSessionUsername';
import { isPlatformFeeYearAccount } from '@/lib/books/access';

interface FeeYear {
  collectedCents: number;
  refundedCents: number;
  netCents: number;
  shopRevenueIncluded: boolean;
  inPersonOwedCents?: number;
  weekLabel?: string;
  history: Array<{ id: string; shopId: string; kind: string; feeCents: number; at: string }>;
  perShop: Array<{ shopId: string; shopName?: string; collectedCents: number; refundedCents: number; netCents: number; inPersonOwedCents?: number }>;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function FeeYearEndPage() {
  const router = useRouter();
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const session = useSessionUsername();
  const allowed = isPlatformFeeYearAccount(session.username);
  const [year, setYear] = useState<FeeYear | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoading || !session.ready || !user) return;
    if (!allowed) router.replace('/admin/home' as Route);
  }, [allowed, isLoading, router, session.ready, user]);

  useEffect(() => {
    if (!allowed) return;
    const token = localStorage.getItem('token');
    fetch('/api/admin/fee-year-end', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(body.error || 'Could not load fee year-end');
          return;
        }
        setYear(body);
      })
      .catch(() => setError('Could not load fee year-end'));
  }, [allowed]);

  if (!allowed) return null;
  if (!year) return <div style={{ padding: 32, color: '#e5e7eb' }}>{error || 'Loading...'}</div>;

  return (
    <div style={{ minHeight: '100vh', color: '#e5e7eb', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <h1 style={{ marginTop: 0 }}>Platform fee year-end</h1>
      <p>Fees collected {money(year.collectedCents)}. Fee refunds {money(year.refundedCents)}. Net fees {money(year.netCents)}.</p>
      <p>Shop bay revenue is not on this page.</p>
      <p>
        In-person fees shops still owe FixTray for the week of {year.weekLabel || 'this week'}: {money(year.inPersonOwedCents || 0)}.
        Card fees above were already collected. This owed amount is not a shop expense.
      </p>
      {error && <p>{error}</p>}
      <h2>Per shop</h2>
      {year.perShop.map((shop) => (
        <p key={shop.shopId}>{shop.shopName || shop.shopId}: collected {money(shop.collectedCents)}, refunded {money(shop.refundedCents)}, net {money(shop.netCents)}, in-person owed this week {money(shop.inPersonOwedCents || 0)}</p>
      ))}
      <h2>History</h2>
      {year.history.map((row) => (
        <p key={row.id}>{row.at} {row.shopId} {row.kind} {money(row.feeCents)}</p>
      ))}
      <button
        type="button"
        onClick={async () => {
          const token = localStorage.getItem('token');
          const response = await fetch('/api/admin/fee-year-end?format=csv', {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!response.ok) {
            setError('Could not download the accountant export');
            return;
          }
          const csv = await response.text();
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'fixtray-fee-year.csv';
          link.click();
          URL.revokeObjectURL(url);
        }}
      >
        Accountant CSV
      </button>
    </div>
  );
}
