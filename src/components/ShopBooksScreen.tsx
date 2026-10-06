'use client';

import { useCallback, useEffect, useState } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import type { ShopYearReport } from '@/lib/books/shopDrill';
import ShopYearDrill from '@/components/books/ShopYearDrill';
import { pageStyle } from '@/components/books/drillChrome';

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
  tickets: Array<{ workOrderId: string; sync: { synced: boolean; issues: string[] }; taxLines: Array<{ kind: string; baseCents: number; taxCents: number }> }>;
  figures?: {
    invoicedCents: number;
    paidCents: number;
    arCents: number;
    customerCreditCents: number;
    revenueCents: number;
    flags: string[];
  };
  qbMap: Record<string, string>;
  inventory: Array<{ id: string; name: string; sku?: string | null; onHand: number; unitCostCents: number; sellUnitCents: number }>;
  fixtrayOwed?: {
    owedCents: number;
    openLines?: Array<{ workOrderId: string; feeCents: number }>;
    weekLabel: string;
    week: {
      owedCents: number;
      accruedCents: number;
      settledCents: number;
      openLines?: Array<{ workOrderId: string; feeCents: number }>;
    };
    feeDeductedFromShop: false;
  };
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' };
}

export default function ShopBooksScreen({ role }: { role: 'shop' | 'manager' }) {
  const { user, isLoading } = useRequireAuth(role === 'shop' ? ['shop', 'accountant'] : [role]);
  const readOnly = user?.role === 'accountant';
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [books, setBooks] = useState<BooksPayload | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [depositJob, setDepositJob] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDate, setDepositDate] = useState('');
  const [partId, setPartId] = useState('');
  const [partQuery, setPartQuery] = useState('');
  const [partQty, setPartQty] = useState('1');
  const [partReason, setPartReason] = useState('');
  const [drill, setDrill] = useState<ShopYearReport | null>(null);
  const [reportYear, setReportYear] = useState<number | null>(null);

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

  const loadDrill = useCallback(async (year?: number) => {
    const query = year ? `?view=drill&year=${year}` : '?view=drill';
    const response = await fetch(`/api/shop/books${query}`, { headers: authHeaders() });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Could not load the books report');
      return;
    }
    setDrill(body);
  }, []);

  useEffect(() => {
    if (!user) return;
    load().catch(() => setError('Could not load the shop ledger'));
    loadDrill(reportYear || undefined).catch(() => setError('Could not load the books report'));
  }, [user, load, loadDrill, reportYear]);

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

  if (isLoading) return <div style={pageStyle}>Loading...</div>;
  if (!user || !books) return <div style={pageStyle}>{error || 'Loading...'}</div>;

  const ledger = books.ledger;
  const showRevenue = (role === 'shop' || readOnly) && drill?.revenueVisible !== false;
  return (
    <div style={pageStyle}>
      <h1 style={{ marginTop: 0 }}>Shop books</h1>
      <p>{books.copy}</p>
      <p>{books.quickBooksOwnsBooks}</p>
      <label>
        Month{' '}
        <input value={month} onChange={(event) => setMonth(event.target.value)} type="month" />
      </label>
      {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
      {notice && <p style={{ color: '#86efac' }}>{notice}</p>}
      {drill ? (
        <ShopYearDrill report={drill} onYear={setReportYear} />
      ) : (
        <p>Loading the year report...</p>
      )}
      {showRevenue && (
      <section>
        <h2>Ledger</h2>
        <p>Customer paid {money(books.figures?.paidCents ?? ledger.customerPaidJobCents)}. Shop received {money(books.figures?.paidCents ?? ledger.shopReceivedCents)}. Shop revenue {money(books.figures?.revenueCents ?? ledger.shopTotalCents)} excludes the FixTray fee.</p>
        <p>Platform fee {money(ledger.platformFeeCents)} is separate and is not a shop deduction.</p>
        <p>
          Invoiced {money(books.figures?.invoicedCents ?? 0)} · Paid {money(books.figures?.paidCents ?? books.report.paidCents)} · AR {money(books.figures?.arCents ?? books.report.unpaidCents)} · Customer credit {money(books.figures?.customerCreditCents ?? 0)}
        </p>
        {(books.figures?.flags || []).length > 0 && (
          <p>Needs a look: {books.figures?.flags.join(', ').replaceAll('_', ' ')}.</p>
        )}
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
      )}
      <section>
        <h2>Month close</h2>
        <p>{books.monthClose.readyToSync ? 'Ready to sync.' : 'Not ready to sync.'}</p>
        {books.monthClose.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        {(role === 'shop' || readOnly) && <button type="button" onClick={exportBooks}>Download QuickBooks CSV</button>}
      </section>
      {!readOnly && <section>
        <h2>Deposit</h2>
        <input placeholder="Job id" value={depositJob} onChange={(event) => setDepositJob(event.target.value)} />
        <input placeholder="Amount cents" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} />
        <input type="date" value={depositDate} onChange={(event) => setDepositDate(event.target.value)} />
        <button type="button" onClick={() => post('deposit', { workOrderId: depositJob, amountCents: Number(depositAmount), depositAt: depositDate })}>Record deposit</button>
      </section>}
      <section>
        <h2>FixTray owed this week</h2>
        <p>
          Week of {books.fixtrayOwed?.weekLabel || 'this week'}: {money(books.fixtrayOwed?.week.owedCents || 0)} from in-person payments.
          The shop kept the full job. This fee is owed to FixTray and is not a shop expense.
        </p>
        {(books.fixtrayOwed?.week.openLines || []).length === 0 ? (
          <p>No open in-person fees this week.</p>
        ) : (
          <ul>
            {(books.fixtrayOwed?.week.openLines || []).map((line) => (
              <li key={line.workOrderId}>
                Work order {line.workOrderId}: {money(line.feeCents)} still open
              </li>
            ))}
          </ul>
        )}
        <p>Open balance across weeks: {money(books.fixtrayOwed?.owedCents || 0)}.</p>
        {(books.fixtrayOwed?.openLines || []).length > 0 && (
          <ul>
            {(books.fixtrayOwed?.openLines || []).map((line) => (
              <li key={`open-${line.workOrderId}`}>
                Work order {line.workOrderId}: {money(line.feeCents)} open balance
              </li>
            ))}
          </ul>
        )}
        {!readOnly && (
          <>
        <button type="button" onClick={async () => {
          const response = await fetch('/api/shop/books', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ action: 'fee-invoice' }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            setError(body.error || 'Could not send the FixTray invoice');
            return;
          }
          setNotice(body.sent ? 'FixTray invoice emailed' : 'Invoice prepared. Email was not sent.');
        }}>Email FixTray invoice</button>
        <button type="button" onClick={async () => {
          const response = await fetch('/api/shop/books', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ action: 'pay-fixtray' }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok || !body.url) {
            setError(body.error || 'Could not start FixTray payment');
            return;
          }
          window.location.href = body.url;
        }}>Pay FixTray</button>
          </>
        )}
      </section>
      {!readOnly && <section>
        <h2>Parts</h2>
        <input placeholder="Search name or SKU" value={partQuery} onChange={(event) => setPartQuery(event.target.value)} />
        <select value={partId} onChange={(event) => setPartId(event.target.value)}>
          <option value="">Choose a stock part</option>
          {books.inventory
            .filter((item) => {
              const query = partQuery.trim().toLowerCase();
              if (!query) return true;
              return item.name.toLowerCase().includes(query) || (item.sku || '').toLowerCase().includes(query);
            })
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}{item.sku ? ` (${item.sku})` : ''} — {item.onHand} on hand
              </option>
            ))}
        </select>
        <input placeholder="Qty" value={partQty} onChange={(event) => setPartQty(event.target.value)} />
        <input placeholder="Reason (required for return and adjust)" value={partReason} onChange={(event) => setPartReason(event.target.value)} />
        <button type="button" onClick={() => post('part', { itemId: partId, kind: 'use', qty: Number(partQty) })}>Use</button>
        <button type="button" disabled={!partReason.trim()} onClick={() => post('part', { itemId: partId, kind: 'return', qty: Number(partQty), reason: partReason })}>Return</button>
        <button type="button" disabled={!partReason.trim()} onClick={() => post('part', { itemId: partId, kind: 'adjust', qty: Number(partQty), reason: partReason })}>Adjust</button>
      </section>}
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
