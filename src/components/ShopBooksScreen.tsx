'use client';

import { useCallback, useEffect, useState } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';

type Standing = 'unpaid' | 'partial' | 'paid' | 'reversed';

interface JobRow {
  id: string;
  jobCents: number;
  customerPaidJobCents: number;
  shopReceivedCents: number;
  platformFeeCents: number;
  depositCents: number | null;
  depositAt: string | null;
  standing: Standing;
}

interface BooksPayload {
  copy: string;
  quickBooksOwnsBooks: string;
  ledger: {
    jobs: JobRow[];
    customerPaidJobCents: number;
    shopReceivedCents: number;
    shopTotalCents: number;
    platformFeeCents: number;
    feeDeductedFromShop: boolean;
    standing: {
      unpaid: { count: number; remainingCents: number };
      partial: { count: number; remainingCents: number };
      paid: { count: number; paidCents: number };
    };
  };
  report: {
    unpaidCents: number;
    partialCents: number;
    paidCents: number;
    shopReceivedCents: number;
  };
  monthClose: { readyToSync: boolean; warnings: string[] };
  inventory: Array<{ id: string; name: string; onHand: number; unitCostCents: number; sellUnitCents: number }>;
  tickets: Array<{ workOrderId: string; sync: { synced: boolean; issues: string[] }; taxLines: Array<{ kind: string; baseCents: number; taxCents: number }> }>;
  qbMap: Record<string, string>;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' };
}

export default function ShopBooksScreen({ role }: { role: 'shop' | 'manager' }) {
  const { user, isLoading } = useRequireAuth([role]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [books, setBooks] = useState<BooksPayload | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [depositJob, setDepositJob] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDate, setDepositDate] = useState('');
  const [partId, setPartId] = useState('');
  const [partQty, setPartQty] = useState('1');
  const [partReason, setPartReason] = useState('');

  const load = useCallback(async () => {
    setError('');
    const response = await fetch(`/api/shop/books?month=${month}`, { headers: authHeaders() });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Could not load the shop ledger');
      return;
    }
    setBooks(body);
  }, [month]);

  useEffect(() => {
    if (!user) return;
    load().catch(() => setError('Could not load the shop ledger'));
  }, [user, load]);

  async function post(action: string, extra: Record<string, unknown>) {
    setNotice('');
    setError('');
    const response = await fetch('/api/shop/books', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action, ...extra }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Could not save');
      return;
    }
    setNotice('Saved');
    await load();
  }

  async function exportBooks() {
    setNotice('');
    setError('');
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/shop/books/export?month=${month}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (response.status === 409) {
      const body = await response.json();
      setError((body.warnings || []).join(' '));
      return;
    }
    if (!response.ok) {
      setError('Export failed');
      return;
    }
    const csv = await response.text();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fixtray-quickbooks-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('QuickBooks handoff downloaded');
  }

  if (isLoading) return <div style={{ padding: 32, color: '#e5e7eb' }}>Loading...</div>;
  if (!user || !books) return <div style={{ padding: 32, color: '#e5e7eb' }}>{error || 'Loading...'}</div>;

  const ledger = books.ledger;
  return (
    <div style={{ minHeight: '100vh', color: '#e5e7eb', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <h1 style={{ marginTop: 0 }}>Shop books</h1>
      <p>{books.copy}</p>
      <p>{books.quickBooksOwnsBooks}</p>
      <label>
        Month{' '}
        <input value={month} onChange={(event) => setMonth(event.target.value)} type="month" />
      </label>
      {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
      {notice && <p style={{ color: '#86efac' }}>{notice}</p>}
      <section>
        <h2>Ledger</h2>
        <p>Customer paid {money(ledger.customerPaidJobCents)}. Shop received {money(ledger.shopReceivedCents)}. Shop total {money(ledger.shopTotalCents)}.</p>
        <p>Platform fee {money(ledger.platformFeeCents)} is separate and is not a shop deduction.</p>
        <p>
          Unpaid {money(books.report.unpaidCents)} · Partial {money(books.report.partialCents)} · Paid {money(books.report.paidCents)}
        </p>
        <table>
          <thead>
            <tr>
              <th>Job</th><th>Job amount</th><th>Customer paid</th><th>Shop received</th><th>Deposit</th><th>Standing</th>
            </tr>
          </thead>
          <tbody>
            {ledger.jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.id}</td>
                <td>{money(job.jobCents)}</td>
                <td>{money(job.customerPaidJobCents)}</td>
                <td>{money(job.shopReceivedCents)}</td>
                <td>{job.depositAt ? `${money(job.depositCents || 0)} ${job.depositAt.slice(0, 10)}` : 'Missing'}</td>
                <td>{job.standing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2>Month close</h2>
        <p>{books.monthClose.readyToSync ? 'Ready to sync.' : 'Not ready to sync.'}</p>
        {books.monthClose.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        <button type="button" onClick={exportBooks}>Download QuickBooks CSV</button>
      </section>
      <section>
        <h2>Deposit</h2>
        <input placeholder="Job id" value={depositJob} onChange={(event) => setDepositJob(event.target.value)} />
        <input placeholder="Amount cents" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} />
        <input type="date" value={depositDate} onChange={(event) => setDepositDate(event.target.value)} />
        <button type="button" onClick={() => post('deposit', { workOrderId: depositJob, amountCents: Number(depositAmount), depositAt: depositDate })}>Record deposit</button>
      </section>
      <section>
        <h2>Parts</h2>
        {books.inventory.map((item) => (
          <p key={item.id}>{item.name}: {item.onHand} on hand, cost {money(item.unitCostCents)}, sell {money(item.sellUnitCents)}</p>
        ))}
        <input placeholder="Part id" value={partId} onChange={(event) => setPartId(event.target.value)} />
        <input placeholder="Qty" value={partQty} onChange={(event) => setPartQty(event.target.value)} />
        <input placeholder="Adjust reason" value={partReason} onChange={(event) => setPartReason(event.target.value)} />
        <button type="button" onClick={() => post('part', { itemId: partId, kind: 'use', qty: Number(partQty) })}>Use</button>
        <button type="button" onClick={() => post('part', { itemId: partId, kind: 'return', qty: Number(partQty) })}>Return</button>
        <button type="button" onClick={() => post('part', { itemId: partId, kind: 'adjust', qty: Number(partQty), reason: partReason })}>Adjust</button>
      </section>
      <section>
        <h2>Tickets</h2>
        {books.tickets.map((ticket) => (
          <p key={ticket.workOrderId}>
            {ticket.workOrderId}: {ticket.sync.synced ? 'estimate, invoice, and payment match' : ticket.sync.issues.join('; ')}
            {ticket.taxLines.length > 0 ? ` Tax ${ticket.taxLines.map((line) => `${line.kind} ${money(line.taxCents)}`).join(', ')}` : ''}
          </p>
        ))}
      </section>
    </div>
  );
}
