'use client';

import { useEffect, useState } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { Metric, money, pageStyle } from '@/components/books/drillChrome';

interface SheetLine {
  key: string;
  label: string;
  cents: number;
  side: 'asset' | 'liability' | 'equity';
}

interface Statements {
  from: string;
  to: string;
  timeZone: string;
  readOnly: boolean;
  basisNote?: string;
  books: { invoicedCents: number; paidCents: number; revenueCents: number; arCents: number; customerCreditCents: number };
  profitAndLoss: {
    basis?: string;
    revenueCents?: number;
    netIncomeCents: number;
    accrualInvoicedCents?: number;
    cogsCents: number;
    salesTaxCents: number;
    note?: string;
  };
  balanceSheet?: {
    lines: SheetLine[];
    assetsCents: number;
    liabilitiesCents: number;
    equityCents: number;
    balanced: boolean;
  };
  balanceSheetBalances: boolean;
  trialBalance: { debitCents: number; creditCents: number; balanced: boolean };
}

export default function ShopStatements({ focus }: { focus: 'all' | 'pl' | 'balance' }) {
  const { user, isLoading } = useRequireAuth(['shop', 'accountant']);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<Statements | null>(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [invited, setInvited] = useState('');

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
    setError('');
    fetch(`/api/shop/accounting?from=${from}&to=${to}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(body?.error || 'Could not load statements');
          setData(null);
          return;
        }
        setData(body);
      })
      .catch(() => setError('Could not load statements'));
  }, [user, from, to]);

  const invite = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/shop/accountants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setInvited(body?.error || 'Invite failed');
      return;
    }
    setInvited(`Invited ${body.email}. Temporary password: ${body.temporaryPassword}`);
    setEmail('');
  };

  if (isLoading || !user) return null;
  const readOnly = user.role === 'accountant';
  const title = focus === 'pl' ? 'Profit & Loss' : focus === 'balance' ? 'Balance Sheet' : 'Statements';
  const cashRevenue = data?.profitAndLoss.revenueCents ?? data?.books.revenueCents ?? 0;
  const sheet = data?.balanceSheet;
  const assets = sheet?.lines.filter((line) => line.side === 'asset') || [];
  const liabilities = sheet?.lines.filter((line) => line.side === 'liability') || [];
  const equity = sheet?.lines.filter((line) => line.side === 'equity') || [];

  return (
    <div style={pageStyle}>
      <h1 style={{ margin: '0 0 8px' }}>{title}</h1>
      <p style={{ color: '#c4a8a4', marginTop: 0 }}>
        {data?.basisNote || data?.profitAndLoss.note || 'Cash basis. Shop money collected in these dates. The FixTray fee is not included.'}
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      {error ? <p>{error}</p> : null}
      {data && focus !== 'balance' ? (
        <>
          <h2>Profit and loss</h2>
          <p style={{ color: '#c4a8a4' }}>{data.timeZone}. Cash basis. This revenue is the same number as Books for these dates.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', gap: 8 }}>
            <Metric label="Cash revenue" value={money(cashRevenue)} hint="Matches Books revenue. Fee excluded." />
            <Metric label="Net income" value={money(data.profitAndLoss.netIncomeCents)} hint="Cash revenue minus costs." />
            <Metric label="Invoiced (accrual)" value={money(data.profitAndLoss.accrualInvoicedCents ?? data.books.invoicedCents)} hint="Invoices in these dates. Not cash revenue." />
            <Metric label="COGS" value={money(data.profitAndLoss.cogsCents)} />
            <Metric label="Sales tax payable" value={money(data.profitAndLoss.salesTaxCents)} />
          </div>
        </>
      ) : null}
      {data && focus !== 'pl' && sheet ? (
        <>
          <h2>Balance sheet</h2>
          <p style={{ color: '#c4a8a4' }}>
            As of {data.to}. Assets {money(sheet.assetsCents)} = liabilities {money(sheet.liabilitiesCents)} + equity {money(sheet.equityCents)}. {sheet.balanced ? 'It balances.' : 'It is out of balance.'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div>
              <h3>Assets</h3>
              {assets.map((line) => <p key={line.key}>{line.label}: {money(line.cents)}</p>)}
              <p>Total assets: {money(sheet.assetsCents)}</p>
            </div>
            <div>
              <h3>Liabilities</h3>
              {liabilities.map((line) => <p key={line.key}>{line.label}: {money(line.cents)}</p>)}
              <p>Total liabilities: {money(sheet.liabilitiesCents)}</p>
            </div>
            <div>
              <h3>Equity</h3>
              {equity.map((line) => <p key={line.key}>{line.label}: {money(line.cents)}</p>)}
              <p>Total equity: {money(sheet.equityCents)}</p>
            </div>
          </div>
          <p style={{ color: '#c4a8a4' }}>Trial balance {data.trialBalance.balanced ? 'balances' : 'is out of balance'}.</p>
        </>
      ) : null}
      {focus === 'all' && (readOnly ? <p style={{ color: '#c4a8a4' }}>Read only.</p> : (
        <div style={{ marginTop: 28 }}>
          <h2>Invite an accountant</h2>
          <p style={{ color: '#c4a8a4' }}>They see only this shop&apos;s books, statements, tax, bills, and exports.</p>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="accountant@email.com" style={{ marginRight: 8 }} />
          <button type="button" onClick={invite}>Invite</button>
          {invited ? <p>{invited}</p> : null}
        </div>
      ))}
    </div>
  );
}
