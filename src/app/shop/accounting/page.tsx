'use client';

import { useEffect, useState } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { Metric, money, pageStyle } from '@/components/books/drillChrome';

interface Statements {
  from: string;
  to: string;
  timeZone: string;
  readOnly: boolean;
  books: { invoicedCents: number; paidCents: number; revenueCents: number; arCents: number; customerCreditCents: number };
  profitAndLoss: {
    laborIncomeCents: number;
    partsIncomeCents: number;
    subletIncomeCents: number;
    refundsCents: number;
    cogsCents: number;
    payrollCents: number;
    shopSuppliesCents: number;
    netIncomeCents: number;
    salesTaxCents: number;
  };
  balanceSheetBalances: boolean;
  trialBalance: { debitCents: number; creditCents: number; balanced: boolean };
}

export default function ShopAccountingPage() {
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
  const income = data ? data.profitAndLoss.laborIncomeCents + data.profitAndLoss.partsIncomeCents + data.profitAndLoss.subletIncomeCents - data.profitAndLoss.refundsCents : 0;

  return (
    <div style={pageStyle}>
      <h1 style={{ margin: '0 0 8px' }}>Statements</h1>
      <p style={{ color: '#c4a8a4', marginTop: 0 }}>Profit and loss and the balance sheet for this shop. The FixTray fee is not in these numbers.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      {error ? <p>{error}</p> : null}
      {data ? (
        <>
          <p style={{ color: '#c4a8a4' }}>{data.timeZone}. Trial balance {data.trialBalance.balanced ? 'balances' : 'is out of balance'}. Balance sheet {data.balanceSheetBalances ? 'balances' : 'is out of balance'}.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', gap: 8 }}>
            <Metric label="Books invoiced" value={money(data.books.invoicedCents)} />
            <Metric label="Statement income" value={money(income)} hint="Labor, parts, and sublet, after refunds" />
            <Metric label="Net income" value={money(data.profitAndLoss.netIncomeCents)} />
            <Metric label="Books revenue" value={money(data.books.revenueCents)} hint="Shop cash, fee excluded" />
            <Metric label="Accounts receivable" value={money(data.books.arCents)} />
            <Metric label="Customer credit" value={money(data.books.customerCreditCents)} />
            <Metric label="Sales tax payable" value={money(data.profitAndLoss.salesTaxCents)} />
            <Metric label="COGS" value={money(data.profitAndLoss.cogsCents)} />
          </div>
        </>
      ) : null}
      {readOnly ? <p style={{ color: '#c4a8a4' }}>Read only.</p> : (
        <div style={{ marginTop: 28 }}>
          <h2>Invite an accountant</h2>
          <p style={{ color: '#c4a8a4' }}>They see only this shop&apos;s books, statements, tax, bills, and exports.</p>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="accountant@email.com" style={{ marginRight: 8 }} />
          <button type="button" onClick={invite}>Invite</button>
          {invited ? <p>{invited}</p> : null}
        </div>
      )}
    </div>
  );
}
