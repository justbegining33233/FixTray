'use client';

import { useCallback, useEffect, useState } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import type { ShopYearReport } from '@/lib/books/shopDrill';
import ShopYearDrill from '@/components/books/ShopYearDrill';
import { pageStyle, sectionCard } from '@/components/books/drillChrome';

type Standing = 'unpaid' | 'partial' | 'paid' | 'reversed';

interface FeeLine {
  workOrderId: string;
  feeCents: number;
  jobCents?: number;
  platformNetCents?: number;
  customerFeeCents?: number;
  formulaFeeCents?: number;
  matchesFullJob?: boolean;
}

interface JobRow {
  id: string;
  jobCents: number;
  customerPaidJobCents: number;
  shopReceivedCents: number;
  platformFeeCents: number;
  depositCents: number | null;
  depositAt: string | null;
  depositDay?: string | null;
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
    missingInvoices?: Array<{ workOrderId: string; flags: string[] }>;
  };
  qbMap: Record<string, string>;
  inventory: Array<{ id: string; name: string; sku?: string | null; onHand: number; unitCostCents: number; sellUnitCents: number }>;
  fixtrayOwed?: {
    owedCents: number;
    openLines?: FeeLine[];
    weekLabel: string;
    week: {
      owedCents: number;
      accruedCents: number;
      settledCents: number;
      openLines?: FeeLine[];
    };
    feeDeductedFromShop: false;
  };
}

interface QboStatus {
  connected: boolean;
  realmId: string | null;
  mapSaved: boolean;
  lastSyncAt: string | null;
  configured: boolean;
  missing: string[];
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
  const [qbo, setQbo] = useState<QboStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

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

  const loadQuickBooks = useCallback(async () => {
    if (user?.role !== 'shop') return;
    const response = await fetch('/api/shop/quickbooks/status', { headers: authHeaders(), credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return;
    setQbo({
      connected: body.connected === true,
      realmId: typeof body.realmId === 'string' ? body.realmId : null,
      mapSaved: body.mapSaved === true,
      lastSyncAt: typeof body.lastSyncAt === 'string' ? body.lastSyncAt : null,
      configured: body.configured === true,
      missing: Array.isArray(body.missing) ? body.missing.filter((item: unknown) => typeof item === 'string') : [],
    });
  }, [user?.role]);

  useEffect(() => {
    if (!user) return;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;
    load()
      .catch(() => setError('Could not load the shop ledger'))
      .finally(() => {
        if (user.role !== 'shop') return;
        const flag = new URLSearchParams(window.location.search).get('quickbooks');
        if (flag === 'connected') setNotice('QuickBooks Online connected');
        if (flag === 'error') setError('QuickBooks Online did not connect. Start again from this page.');
      });
    loadDrill(reportYear || undefined).catch(() => setError('Could not load the books report'));
    loadQuickBooks().catch(() => setError('Could not load QuickBooks Online'));
  }, [user, load, loadDrill, loadQuickBooks, reportYear]);

  async function post(action: string, extra: Record<string, unknown>) {
    setNotice('');
    setError('');
    try {
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
    } catch {
      setError('Could not reach the shop books service. Check the connection and try again.');
    }
  }

  async function exportBooks() {
    setNotice('');
    setError('');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      setError('QuickBooks CSV was not downloaded. Enter the month as YYYY-MM.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/shop/books/export?month=${month}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.status === 409) {
        const body = await response.json().catch(() => ({}));
        const warnings = Array.isArray(body.warnings) ? body.warnings.filter((item: unknown) => typeof item === 'string') : [];
        const reason = [typeof body.copy === 'string' ? body.copy : '', ...warnings].filter(Boolean).join(' ');
        setError(`QuickBooks CSV was not downloaded. ${reason || 'This month is not ready to export.'}`);
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error || 'QuickBooks CSV was not downloaded. Export failed.');
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
    } catch {
      setError('QuickBooks CSV was not downloaded. The request did not finish.');
    }
  }

  async function syncQuickBooks() {
    if (user?.role !== 'shop') return;
    setNotice('');
    setError('');
    setSyncing(true);
    const response = await fetch('/api/shop/quickbooks/sync', {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: JSON.stringify({ month }),
    });
    const body = await response.json().catch(() => ({}));
    setSyncing(false);
    if (response.status === 409) {
      const warnings = Array.isArray(body.warnings) ? body.warnings.filter((item: unknown) => typeof item === 'string') : [];
      const message = [typeof body.error === 'string' ? body.error : '', ...warnings].filter(Boolean).join(' ');
      setError(message || 'Month is not ready to sync');
      return;
    }
    if (!response.ok) {
      setError(body.error || 'QuickBooks sync failed');
      return;
    }
    setNotice('Synced to QuickBooks Online');
    await loadQuickBooks();
  }

  if (isLoading) return <div style={pageStyle}>Loading...</div>;
  if (!user || !books) return <div style={pageStyle}>{error || 'Loading...'}</div>;

  const ledger = books.ledger;
  const showRevenue = role === 'shop' && drill?.revenueVisible !== false;
  const monthReady = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  return (
    <div className="books-sheet" style={pageStyle}>
      <style>{`
        .books-sheet input, .books-sheet select, .books-sheet button {
          background: #1c0d10;
          color: #f8ecea;
          border: 1px solid #5c2428;
          border-radius: 8px;
          padding: 8px 10px;
          margin: 4px 8px 4px 0;
          font: inherit;
        }
        .books-sheet button { cursor: pointer; font-weight: 700; }
        .books-sheet button:disabled { opacity: 0.45; cursor: not-allowed; }
        .books-sheet table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .books-sheet th, .books-sheet td {
          text-align: left;
          padding: 8px;
          border-bottom: 1px solid #4a1c22;
          font-size: 14px;
        }
        .books-sheet a { color: #f0b4ae; }
        .books-sheet h2 { margin: 0 0 8px; }
      `}</style>
      <h1 style={{ marginTop: 0 }}>Shop books</h1>
      <p>{books.copy}</p>
      <p>{books.quickBooksOwnsBooks}</p>
      <label>
        Month{' '}
        <input
          value={month}
          aria-label="Month"
          inputMode="numeric"
          placeholder="YYYY-MM"
          onChange={(event) => setMonth(event.target.value)}
        />
      </label>
      {!monthReady ? <p style={{ color: '#f0b4ae' }}>Use YYYY-MM, for example 2026-10. The report loads when the month is complete.</p> : null}
      {error && (
        <div role="alert" style={{ background: '#3b1214', border: '1px solid #fca5a5', color: '#fecaca', borderRadius: 12, padding: '12px 14px', marginTop: 12, fontWeight: 650 }}>
          {error}
        </div>
      )}
      {notice && (
        <div role="status" style={{ background: '#12301c', border: '1px solid #86efac', color: '#bbf7d0', borderRadius: 12, padding: '12px 14px', marginTop: 12, fontWeight: 650 }}>
          {notice}
        </div>
      )}
      {drill ? (
        <ShopYearDrill report={drill} onYear={setReportYear} />
      ) : (
        <p>Loading the year report...</p>
      )}
      {showRevenue && (
      <section style={sectionCard}>
        <h2>Ledger</h2>
        <p>Customer paid {money(books.figures?.paidCents ?? ledger.customerPaidJobCents)}. Shop received {money(books.figures?.paidCents ?? ledger.shopReceivedCents)}. Shop revenue {money(books.figures?.revenueCents ?? ledger.shopTotalCents)} excludes the FixTray fee.</p>
        <p>Platform fee {money(ledger.platformFeeCents)} is separate and is not a shop deduction.</p>
        <p>
          Invoiced {money(books.figures?.invoicedCents ?? 0)} · Paid {money(books.figures?.paidCents ?? books.report.paidCents)} · AR {money(books.figures?.arCents ?? books.report.unpaidCents)} · Customer credit {money(books.figures?.customerCreditCents ?? 0)}
        </p>
        {(books.figures?.flags || []).length > 0 && (
          <p>Needs a look: {books.figures?.flags.join(', ').replaceAll('_', ' ')}.</p>
        )}
        {(books.figures?.missingInvoices || []).map((row) => (
          <p key={row.workOrderId}>
            {row.workOrderId} is missing an invoice. The payment is still flagged.
            {!readOnly && (
              <button type="button" style={{ marginLeft: 8 }} onClick={() => post('create-invoice', { workOrderId: row.workOrderId })}>
                Create invoice for this paid job
              </button>
            )}
          </p>
        ))}
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
                <td>{job.depositAt ? `${money(job.depositCents || 0)} ${job.depositDay || job.depositAt.slice(0, 10)}` : 'Missing'}</td>
                <td>{job.standing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      )}
      <section style={sectionCard}>
        <h2>Month close</h2>
        <p>{books.monthClose.readyToSync ? 'Ready to sync.' : 'Not ready to sync.'}</p>
        {books.monthClose.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        {user?.role === 'shop' ? (
          <div>
            {qbo?.connected ? (
              <p>QuickBooks Online is connected{qbo.realmId ? ` for company ${qbo.realmId}` : ''}{qbo.lastSyncAt ? `. Last sync ${qbo.lastSyncAt.slice(0, 16).replace('T', ' ')}` : ''}.</p>
            ) : (
              <p>
                Connect QuickBooks Online once, then map accounts and sync this month.{' '}
                <a href="/shop/accounting/quickbooks">Connect QuickBooks Online</a>
                {' · '}
                <a href="/shop/accounting/chart">Map accounts</a>
              </p>
            )}
            {qbo && !qbo.configured && <p>Production still needs {qbo.missing.join(', ')}.</p>}
            {qbo?.connected && (
              <button type="button" onClick={syncQuickBooks} disabled={!books.monthClose.readyToSync || !qbo.mapSaved || syncing}>
                {syncing ? 'Syncing...' : 'Sync to QuickBooks Online'}
              </button>
            )}
          </div>
        ) : role === 'manager' ? (
          <p>The shop owner connects QuickBooks Online and syncs from the shop login.</p>
        ) : null}
        {(role === 'shop' || readOnly) && <button type="button" onClick={exportBooks}>Download QuickBooks CSV</button>}
      </section>
      {!readOnly && <section style={sectionCard}>
        <h2>Deposit</h2>
        <input placeholder="Job id" value={depositJob} onChange={(event) => setDepositJob(event.target.value)} />
        <input placeholder="Amount cents" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} />
        <input type="date" value={depositDate} onChange={(event) => setDepositDate(event.target.value)} />
        <button type="button" onClick={() => post('deposit', { workOrderId: depositJob, amountCents: Number(depositAmount), depositAt: depositDate })}>Record deposit</button>
      </section>}
      {role === 'shop' && <section style={sectionCard}>
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
                Work order {line.workOrderId}: {money(line.customerFeeCents ?? line.feeCents)} still open.
                {' '}Job {money(line.jobCents || 0)}. Platform net {money(line.platformNetCents || 0)}. Customer fee {money(line.customerFeeCents ?? line.feeCents)} is the gross-up on the full job{line.matchesFullJob ? '' : ' (stored snapshot)'}.
              </li>
            ))}
          </ul>
        )}
        <p>Open balance across weeks: {money(books.fixtrayOwed?.owedCents || 0)}.</p>
        {(books.fixtrayOwed?.openLines || []).length > 0 && (
          <ul>
            {(books.fixtrayOwed?.openLines || []).map((line) => (
              <li key={`open-${line.workOrderId}`}>
                Work order {line.workOrderId}: {money(line.customerFeeCents ?? line.feeCents)} open balance.
                {' '}Job {money(line.jobCents || 0)}. Platform net {money(line.platformNetCents || 0)}. Customer fee {money(line.customerFeeCents ?? line.feeCents)} is the gross-up on the full job{line.matchesFullJob ? '' : ' (stored snapshot)'}.
              </li>
            ))}
          </ul>
        )}
        {!readOnly && (
          <>
        <button type="button" onClick={async () => {
          setError('');
          setNotice('');
          try {
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
          } catch {
            setError('Could not send the FixTray invoice. The request did not finish.');
          }
        }}>Email FixTray invoice</button>
        <button type="button" onClick={async () => {
          setError('');
          setNotice('');
          try {
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
          } catch {
            setError('Could not start FixTray payment. The request did not finish.');
          }
        }}>Pay FixTray</button>
          </>
        )}
      </section>}
      {!readOnly && <section style={sectionCard}>
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
      <section style={sectionCard}>
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
