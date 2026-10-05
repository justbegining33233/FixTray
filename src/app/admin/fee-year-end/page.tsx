'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import { useSessionUsername } from '@/lib/useSessionUsername';
import { isPlatformFeeYearAccount } from '@/lib/books/access';
import type { FeeYearReport } from '@/lib/books/feeDrill';
import FeeYearDrill from '@/components/books/FeeYearDrill';
import { money, pageStyle } from '@/components/books/drillChrome';

interface InPersonLine {
  workOrderId: string;
  feeCents: number;
  at?: string;
  shopId?: string;
  shopName?: string;
}

interface FeeYear {
  collectedCents: number;
  refundedCents: number;
  netCents: number;
  shopRevenueIncluded: boolean;
  inPersonOwedCents?: number;
  weekLabel?: string;
  inPersonLines?: InPersonLine[];
  drill?: FeeYearReport;
  history: Array<{ id: string; shopId: string; kind: string; feeCents: number; at: string }>;
  perShop: Array<{
    shopId: string;
    shopName?: string;
    collectedCents: number;
    refundedCents: number;
    netCents: number;
    inPersonOwedCents?: number;
    inPersonLines?: InPersonLine[];
  }>;
}

export default function FeeYearEndPage() {
  const router = useRouter();
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const session = useSessionUsername();
  const allowed = isPlatformFeeYearAccount(session.username);
  const [year, setYear] = useState<FeeYear | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoading || !session.ready || !user) return;
    if (!allowed) router.replace('/admin/home' as Route);
  }, [allowed, isLoading, router, session.ready, user]);

  useEffect(() => {
    if (!allowed) return;
    const token = localStorage.getItem('token');
    const query = selectedYear ? `?year=${selectedYear}` : '';
    fetch(`/api/admin/fee-year-end${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(body.error || 'Could not load fee year-end');
          return;
        }
        setYear(body);
      })
      .catch(() => setError('Could not load fee year-end'));
  }, [allowed, selectedYear]);

  if (!allowed) return null;
  if (!year) return <div style={{ ...pageStyle }}>{error || 'Loading...'}</div>;

  return (
    <div style={pageStyle}>
      <h1 style={{ marginTop: 0 }}>Platform fee year-end</h1>
      <p>Fees collected {money(year.collectedCents)}. Fee refunds {money(year.refundedCents)}. Net fees {money(year.netCents)}.</p>
      <p>Shop bay revenue is not on this page.</p>
      <p>
        In-person fees shops still owe FixTray for the week of {year.weekLabel || 'this week'}: {money(year.inPersonOwedCents || 0)}.
        Card fees above were already collected. This owed amount is not a shop expense.
      </p>
      <h2>In-person owed this week</h2>
      {(year.inPersonLines || []).length === 0 ? (
        <p>No open in-person fees this week.</p>
      ) : (
        <ul>
          {(year.inPersonLines || []).map((line) => (
            <li key={`${line.shopId || ''}-${line.workOrderId}`}>
              {line.shopName || line.shopId}: work order {line.workOrderId} {money(line.feeCents)}
            </li>
          ))}
        </ul>
      )}
      {error && <p>{error}</p>}
      <h2>Per shop</h2>
      {year.perShop.map((shop) => (
        <details key={shop.shopId} open style={{ background: '#1c0d10', border: '1px solid #4a1c22', borderRadius: 12, padding: 12, marginBottom: 8 }}>
          <summary>
            {shop.shopName || shop.shopId}: collected {money(shop.collectedCents)}, refunded {money(shop.refundedCents)}, net {money(shop.netCents)}, in-person owed this week {money(shop.inPersonOwedCents || 0)}
          </summary>
          {(shop.inPersonLines || []).length === 0 ? (
            <p>No open in-person work orders this week.</p>
          ) : (
            <ul>
              {(shop.inPersonLines || []).map((line) => (
                <li key={line.workOrderId}>Work order {line.workOrderId}: {money(line.feeCents)}</li>
              ))}
            </ul>
          )}
        </details>
      ))}
      {year.drill ? <FeeYearDrill report={year.drill} onYear={setSelectedYear} /> : <p>The year drill-down is not available.</p>}
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
        style={{ marginTop: 16, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 16px', minHeight: 44 }}
      >
        Accountant CSV
      </button>
    </div>
  );
}
