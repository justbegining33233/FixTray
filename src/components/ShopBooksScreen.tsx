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
  quickBooksSync?: string;
}

interface QboStatus {
  connected: boolean;
  realmId: string | null;
  mapSaved: boolean;
  qbMap: Record<string, string>;
  lastSyncAt: string | null;
  configured: boolean;
  missing: string[];
}

interface QboAccount {
  id: string;
  name: string;
  accountType: string;
}

const MAP_FIELDS: Array<[string, string]> = [
  ['sales', 'Sales'],
  ['payments', 'Payments'],
  ['refunds', 'Refunds'],
  ['labor', 'Labor'],
  ['parts', 'Parts'],
  ['tax', 'Tax'],
];

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
  const [qbo, setQbo] = useState<QboStatus | null>(null);
  const [accounts, setAccounts] = useState<QboAccount[]>([]);
  const [mapDraft, setMapDraft] = useState<Record<string, string>>({});
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

  const loadQuickBooks = useCallback(async () => {
    if (role !== 'shop') return;
    const response = await fetch('/api/shop/quickbooks/status', { headers: authHeaders(), credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return;
    const status = body as QboStatus;
    setQbo(status);
    setMapDraft(status.qbMap || {});
    if (!status.connected) return;
    const accountsResponse = await fetch('/api/shop/quickbooks/accounts', { headers: authHeaders(), credentials: 'include' });
    const accountsBody = await accountsResponse.json().catch(() => ({}));
    if (accountsResponse.ok && Array.isArray(accountsBody.accounts)) setAccounts(accountsBody.accounts);
  }, [role]);

  useEffect(() => {
    if (!user) return;
    load()
      .catch(() => setError('Could not load the shop ledger'))
      .finally(() => {
        const flag = new URLSearchParams(window.location.search).get('quickbooks');
        if (flag === 'connected') setNotice('QuickBooks Online connected');
        if (flag === 'error') setError('QuickBooks Online did not connect. Start again from this page.');
      });
    loadQuickBooks().catch(() => setError('Could not load QuickBooks Online'));
  }, [user, load, loadQuickBooks]);

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
    setNotice('Optional CSV downloaded');
  }

  async function connectQuickBooks() {
    setNotice('');
    setError('');
    const response = await fetch('/api/shop/quickbooks/connect', { headers: authHeaders(), credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || typeof body.url !== 'string') {
      const missing = Array.isArray(body.missing) ? ` Missing ${body.missing.join(', ')}.` : '';
      setError((body.error || 'Could not start QuickBooks Online') + missing);
      return;
    }
    window.location.href = body.url;
  }

  async function saveQuickBooksMap() {
    setNotice('');
    setError('');
    const response = await fetch('/api/shop/quickbooks/map', {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: JSON.stringify({ map: mapDraft }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Could not save the account map');
      return;
    }
    setNotice('QuickBooks accounts saved');
    await loadQuickBooks();
  }

  async function syncQuickBooks() {
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
      setError((body.warnings || ['Month is not ready to sync']).join(' '));
      return;
    }
    if (!response.ok) {
      setError(body.error || 'QuickBooks sync failed');
      return;
    }
    setNotice('Synced to QuickBooks Online');
    await loadQuickBooks();
  }

  if (isLoading) return <div style={{ padding: 32, color: '#e5e7eb' }}>Loading...</div>;
  if (!user || !books) return <div style={{ padding: 32, color: '#e5e7eb' }}>{error || 'Loading...'}</div>;

  const ledger = books.ledger;
  return (
    <div style={{ minHeight: '100vh', color: '#e5e7eb', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <h1 style={{ marginTop: 0 }}>Shop books</h1>
      <p>{books.copy}</p>
      <p>{books.quickBooksSync || 'Sync sends shop sales, payments, refunds, and labor to QuickBooks Online. The FixTray fee stays on the platform and is not a shop expense.'}</p>
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
        {role === 'shop' ? (
          <div>
            {qbo?.connected ? (
              <p>QuickBooks Online is connected{qbo.realmId ? ` for company ${qbo.realmId}` : ''}{qbo.lastSyncAt ? `. Last sync ${qbo.lastSyncAt.slice(0, 16).replace('T', ' ')}` : ''}.</p>
            ) : (
              <p>Connect QuickBooks Online once, then map accounts and sync this month.</p>
            )}
            {qbo && !qbo.configured && <p>Production still needs {qbo.missing.join(', ')}.</p>}
            {!qbo?.connected && <button type="button" onClick={connectQuickBooks}>Connect QuickBooks Online</button>}
            {qbo?.connected && (
              <div>
                <h3>Account map</h3>
                <p>Map sales, payments, refunds, labor, parts, and tax. Do not map the FixTray fee. It is not a shop expense.</p>
                {MAP_FIELDS.map(([key, label]) => (
                  <label key={key} style={{ display: 'block', marginBottom: 8 }}>
                    {label}{' '}
                    <select
                      aria-label={label}
                      value={mapDraft[key] || ''}
                      onChange={(event) => setMapDraft((current) => ({ ...current, [key]: event.target.value }))}
                    >
                      <option value="">Select {label.toLowerCase()} account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>{account.name}</option>
                      ))}
                      {mapDraft[key] && !accounts.some((account) => account.id === mapDraft[key]) ? (
                        <option value={mapDraft[key]}>{mapDraft[key]}</option>
                      ) : null}
                    </select>
                  </label>
                ))}
                <button type="button" onClick={saveQuickBooksMap}>Save account map</button>
                <button type="button" onClick={syncQuickBooks} disabled={!books.monthClose.readyToSync || !qbo.mapSaved || syncing}>
                  {syncing ? 'Syncing...' : 'Sync to QuickBooks Online'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p>The shop owner connects QuickBooks Online and syncs from the shop login.</p>
        )}
        <button type="button" onClick={exportBooks}>Optional CSV download</button>
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
