import fs from 'fs';
import { customerFacingServiceFeeCents } from '../src/lib/serviceFeeBill';
import {
  assembleShopJobs,
  monthClose,
  reportsMatchLedger,
  shopLedger,
  shopReport,
  type BooksRow,
  type OrderInput,
} from '../src/lib/books/money';
import { laborPayCents } from '../src/lib/books/clocks';
import {
  buildQboSyncBatch,
  intuitConfig,
  postQboSyncBatch,
  qboAccountMap,
  qboAudit,
  qboAuthorizeUrl,
  qboStateSecret,
  qboTokenRequest,
  QBO_PRODUCTION_ENV,
  signQboState,
  syncMatchesLedger,
  verifyQboState,
} from '../src/lib/books/qbo';
import { booksAccess } from '../src/lib/books/access';

const AT = '2026-10-05T15:00:00.000Z';
const FEE = 4047;
const MAP = {
  sales: '81',
  payments: '82',
  refunds: '83',
  labor: '84',
  parts: '85',
  tax: '86',
};

function order(partial: Partial<OrderInput> & { id: string }): OrderInput {
  return {
    shopId: 'shop-1',
    estimatedCost: 1000,
    amountPaid: null,
    paymentStatus: 'unpaid',
    createdAt: '2026-10-02T12:00:00.000Z',
    ...partial,
  };
}

function row(partial: Partial<BooksRow> & Pick<BooksRow, 'id' | 'kind' | 'appliesTo' | 'amountCents'>): BooksRow {
  return {
    workOrderId: 'job-1',
    status: 'posted',
    createdAt: '2026-10-02T12:00:00.000Z',
    ...partial,
  };
}

function paidJobs() {
  return assembleShopJobs(
    [order({ id: 'job-1', estimatedCost: 1000, amountPaid: 1040.47, paymentStatus: 'paid' })],
    [
      row({ id: 'p', kind: 'card_payment', appliesTo: 'job', amountCents: 100_000 }),
      row({ id: 'f', kind: 'card_payment', appliesTo: 'fee', amountCents: FEE }),
      row({ id: 'd', kind: 'deposit', appliesTo: 'job', amountCents: 100_000, depositAt: '2026-10-04T00:00:00.000Z' }),
    ],
  );
}

describe('QuickBooks Online sync', () => {
  it('keeps the platform fee out of the shop payload and matches the ledger', () => {
    const liveFee = customerFacingServiceFeeCents(100_000, 1000);
    expect(liveFee).toBe(FEE);
    const jobs = paidJobs();
    const ledger = shopLedger(jobs);
    const close = monthClose(jobs);
    expect(close.readyToSync).toBe(true);
    expect(ledger.platformFeeCents).toBe(FEE);
    expect(ledger.shopReceivedCents).toBe(100_000);
    expect(ledger.customerPaidJobCents).toBe(ledger.shopReceivedCents);
    expect(ledger.feeDeductedFromShop).toBe(false);
    expect(reportsMatchLedger(ledger, shopReport(ledger))).toBe(true);

    const batch = buildQboSyncBatch({
      shopId: 'shop-1',
      month: '2026-10',
      jobs,
      reversals: [
        { id: 'fee-refund', appliesTo: 'fee', kind: 'refund', amountCents: FEE, at: AT, workOrderId: 'job-1' },
        { id: 'open-job', appliesTo: 'job', kind: 'refund', amountCents: 100, at: AT, status: 'open', workOrderId: 'job-1' },
      ],
      labor: [{ personId: 'tech-1', minutes: 510, hourlyRateCents: 2_000 }],
      parts: [{ workOrderId: 'job-1', amountCents: 2_500 }],
      tax: [{ workOrderId: 'job-1', taxCents: 825 }],
      map: { ...MAP, feeExpense: '99', platformFee: '77' },
      close,
    });
    expect(batch.ok).toBe(false);
    if (batch.ok) return;

    const clean = buildQboSyncBatch({
      shopId: 'shop-1',
      month: '2026-10',
      jobs,
      reversals: [
        { id: 'fee-refund', appliesTo: 'fee', kind: 'refund', amountCents: FEE, at: AT, workOrderId: 'job-1' },
        { id: 'open-job', appliesTo: 'job', kind: 'refund', amountCents: 100, at: AT, status: 'open', workOrderId: 'job-1' },
      ],
      labor: [{ personId: 'tech-1', minutes: 510, hourlyRateCents: 2_000 }],
      parts: [{ workOrderId: 'job-1', amountCents: 2_500 }],
      tax: [{ workOrderId: 'job-1', taxCents: 825 }],
      map: MAP,
      close,
    });
    expect(clean.ok).toBe(true);
    if (!clean.ok) return;
    expect(syncMatchesLedger(clean.totals, ledger)).toBe(true);
    expect(clean.totals.netShopCents).toBe(ledger.shopReceivedCents);
    expect(clean.totals.paymentsCents).toBe(100_000);
    expect(clean.totals.salesCents).toBe(100_000);
    expect(clean.totals.refundsCents).toBe(0);
    expect(clean.totals.partsCents).toBe(2_500);
    expect(clean.totals.taxCents).toBe(825);
    expect(clean.totals.laborCents).toBe(laborPayCents(510, 2_000));
    expect(clean.map).not.toHaveProperty('feeExpense');

    const payload = JSON.stringify(clean.requests);
    expect(payload).not.toContain(String(FEE));
    expect(payload).not.toContain((FEE / 100).toFixed(2));
    expect(payload).not.toContain('FixTray');
    expect(payload).not.toContain('feeExpense');
    expect(payload.toLowerCase()).not.toContain('platform fee');
    expect(payload).not.toContain('"Expense"');
    expect(clean.requests.some((request) => request.entity === 'JournalEntry')).toBe(true);
    expect(clean.requests.some((request) => request.entity === 'TimeActivity')).toBe(true);
    const labor = clean.requests.find((request) => request.entity === 'TimeActivity');
    expect(labor?.body).toMatchObject({ Hours: 8, Minutes: 30, HourlyRate: 20, Description: 'Shop labor' });
    expect(labor?.lines[0].accountId).toBe(MAP.labor);
    const accounts = new Set(clean.requests.flatMap((request) => request.lines.map((line) => line.accountId)));
    expect([...accounts].sort()).toEqual(['81', '82', '84', '85', '86']);
  });

  it('posts a job refund without the fee and still matches shop received', () => {
    const jobs = assembleShopJobs(
      [order({ id: 'job-1', estimatedCost: 100, amountPaid: 0, paymentStatus: 'refunded' })],
      [
        row({ id: 'p', kind: 'card_payment', appliesTo: 'job', amountCents: 10_000 }),
        row({ id: 'f', kind: 'card_payment', appliesTo: 'fee', amountCents: FEE }),
        row({ id: 'rj', kind: 'refund', appliesTo: 'job', amountCents: 10_000, sourceId: 're_job' }),
        row({ id: 'rf', kind: 'refund', appliesTo: 'fee', amountCents: FEE, sourceId: 're_fee' }),
      ],
    );
    const ledger = shopLedger(jobs);
    const close = monthClose(jobs);
    expect(ledger.shopReceivedCents).toBe(0);
    expect(ledger.platformFeeCents).toBe(0);
    expect(close.readyToSync).toBe(true);
    const batch = buildQboSyncBatch({
      shopId: 'shop-1',
      month: '2026-10',
      jobs,
      reversals: [
        { id: 'rj', appliesTo: 'job', kind: 'refund', amountCents: 10_000, at: AT, workOrderId: 'job-1' },
        { id: 'rf', appliesTo: 'fee', kind: 'refund', amountCents: FEE, at: AT, workOrderId: 'job-1' },
      ],
      labor: [],
      map: MAP,
      close,
    });
    expect(batch.ok).toBe(true);
    if (!batch.ok) return;
    expect(syncMatchesLedger(batch.totals, ledger)).toBe(true);
    expect(batch.totals.netShopCents).toBe(0);
    expect(batch.totals.refundsCents).toBe(10_000);
    expect(batch.totals.paymentsCents - batch.totals.refundsCents).toBe(ledger.shopTotalCents);
    const payload = JSON.stringify(batch.requests);
    expect(payload).not.toContain(String(FEE));
    expect(payload).not.toContain('40.47');
    expect(payload).toContain('Shop job refund');
  });

  it('blocks a dirty month before any QuickBooks payload is built', () => {
    const jobs = assembleShopJobs(
      [
        order({ id: 'job-1', paymentStatus: 'paid', amountPaid: 110, estimatedCost: 100 }),
        order({ id: 'job-2', estimatedCost: 50, paymentStatus: 'unpaid' }),
      ],
      [
        row({ id: 'p', kind: 'card_payment', appliesTo: 'job', amountCents: 10_000 }),
        row({ id: 'f', kind: 'card_payment', appliesTo: 'fee', amountCents: FEE }),
      ],
    );
    const close = monthClose(jobs);
    expect(close.readyToSync).toBe(false);
    const batch = buildQboSyncBatch({
      shopId: 'shop-1',
      month: '2026-10',
      jobs,
      reversals: [],
      labor: [{ personId: 'tech-1', minutes: 60, hourlyRateCents: 2_000 }],
      map: MAP,
      close,
    });
    expect(batch.ok).toBe(false);
    if (batch.ok) return;
    expect(batch.blocked).toBe(true);
    expect(batch.requests).toEqual([]);
    expect(batch.warnings.length).toBeGreaterThan(0);
  });

  it('signs OAuth state to the shop and keeps the client secret out of the authorize URL', () => {
    const secret = 'state-secret';
    const state = signQboState({ shopId: 'shop-1', nowMs: 1_000, secret });
    const verified = verifyQboState(state, secret, 1_000);
    expect(verified).toEqual({ ok: true, shopId: 'shop-1' });
    expect(verifyQboState(state, 'other-secret', 1_000).ok).toBe(false);
    expect(verifyQboState(state, secret, 1_000 + 16 * 60 * 1000).ok).toBe(false);
    const [body] = state.split('.');
    const forged = `${Buffer.from(JSON.stringify({ shopId: 'shop-2', exp: 99_999, n: 'x' })).toString('base64url')}.${state.split('.')[1]}`;
    expect(verifyQboState(forged, secret, 1_000).ok).toBe(false);
    expect(body.length).toBeGreaterThan(10);

    const url = qboAuthorizeUrl({
      clientId: 'intuit-client',
      redirectUri: 'https://fixtray.app/api/shop/quickbooks/callback',
      state,
    });
    expect(url.startsWith('https://appcenter.intuit.com/connect/oauth2?')).toBe(true);
    expect(url).toContain('client_id=intuit-client');
    expect(url).toContain('com.intuit.quickbooks.accounting');
    expect(url).not.toContain('intuit-secret-value');

    const token = qboTokenRequest({
      clientId: 'intuit-client',
      clientSecret: 'intuit-secret-value',
      grant: {
        type: 'authorization_code',
        code: 'auth-code',
        redirectUri: 'https://fixtray.app/api/shop/quickbooks/callback',
      },
    });
    expect(token.body).toContain('grant_type=authorization_code');
    expect(token.body).not.toContain('intuit-secret-value');
    expect(token.headers.Authorization.startsWith('Basic ')).toBe(true);

    const missing = intuitConfig({});
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.missing).toEqual([...QBO_PRODUCTION_ENV]);
    const configured = intuitConfig({
      INTUIT_CLIENT_ID: 'intuit-client',
      INTUIT_CLIENT_SECRET: 'intuit-secret-value',
      INTUIT_REDIRECT_URI: 'https://fixtray.app/api/shop/quickbooks/callback',
      INTUIT_ENVIRONMENT: 'sandbox',
    });
    expect(configured.ok).toBe(true);
    if (!configured.ok) return;
    expect(configured.config.apiHost).toBe('https://sandbox-quickbooks.api.intuit.com');
    expect(qboStateSecret({ NODE_ENV: 'production' })).toBeNull();
    expect(qboAccountMap({ ...MAP, feeExpense: '99' })).toEqual({
      ok: false,
      error: 'The FixTray fee is not a shop QuickBooks account',
    });
    expect(booksAccess('shop').quickBooksConnect).toBe(true);
    expect(booksAccess('manager').quickBooksConnect).toBe(false);
    const audit = qboAudit({
      actorId: 'owner-1',
      at: AT,
      shopId: 'shop-1',
      action: 'books.quickbooks_sync',
      details: 'synced 1 entities; fee excluded',
    });
    expect(audit.actorId).toBe('owner-1');
    expect(audit.at).toBe(AT);
    expect(audit.action).toBe('books.quickbooks_sync');

    const source = fs.readFileSync('src/lib/books/qbo.ts', 'utf8');
    for (const name of QBO_PRODUCTION_ENV) expect(source).toContain(name);
    expect(source).not.toMatch(/INTUIT_CLIENT_SECRET\s*=\s*['"][A-Za-z0-9]/);
  });

  it('posts the shop batch and does not send the fee cents', async () => {
    const jobs = paidJobs();
    const ledger = shopLedger(jobs);
    const batch = buildQboSyncBatch({
      shopId: 'shop-1',
      month: '2026-10',
      jobs,
      reversals: [{ id: 'rf', appliesTo: 'fee', kind: 'refund', amountCents: FEE, at: AT, workOrderId: 'job-1' }],
      labor: [{ personId: 'tech-1', minutes: 60, hourlyRateCents: 3_000 }],
      map: MAP,
      close: monthClose(jobs),
    });
    expect(batch.ok).toBe(true);
    if (!batch.ok) return;
    expect(syncMatchesLedger(batch.totals, ledger)).toBe(true);
    const calls: Array<{ method: string; body: string }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ method: init?.method || 'GET', body: typeof init?.body === 'string' ? init.body : '' });
      if (String(url).includes('/query')) {
        return new Response(JSON.stringify({ QueryResponse: {} }), { status: 200 });
      }
      const entity = String(url).includes('timeactivity') ? 'TimeActivity' : 'JournalEntry';
      return new Response(JSON.stringify({ [entity]: { Id: '55' } }), { status: 200 });
    }) as typeof fetch;
    const posted = await postQboSyncBatch({
      apiHost: 'https://sandbox-quickbooks.api.intuit.com',
      realmId: '123456789',
      accessToken: 'access-token',
      requests: batch.requests,
      fetchImpl,
    });
    expect(posted.ok).toBe(true);
    const sent = JSON.stringify(calls);
    expect(sent).not.toContain(String(FEE));
    expect(sent).not.toContain('40.47');
    expect(calls.some((call) => call.method === 'POST' && call.body.includes('Shop payment'))).toBe(true);
    expect(calls.some((call) => call.method === 'POST' && call.body.includes('Shop labor'))).toBe(true);
  });

  it('keeps shop-owner sync and the live account picker on the current books screens', () => {
    const books = fs.readFileSync('src/components/ShopBooksScreen.tsx', 'utf8');
    const chart = fs.readFileSync('src/app/shop/accounting/chart/page.tsx', 'utf8');
    expect(books).toContain("user?.role === 'shop'");
    expect(books).toContain('/api/shop/quickbooks/sync');
    expect(books).toContain('Sync to QuickBooks Online');
    expect(books).toContain("flag === 'connected'");
    expect(books).toContain('Download QuickBooks CSV');
    expect(books).toContain('The shop owner connects QuickBooks Online and syncs from the shop login.');
    expect(chart).toContain('/api/shop/quickbooks/accounts');
    expect(chart).toContain('Do not map the FixTray fee');
  });
});
