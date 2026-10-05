/**
 * QuickBooks Online OAuth and shop sync.
 *
 * The shop owner connects once. Sync posts sales, payments, job refunds,
 * parts, tax, and labor to the mapped accounts. The customer FixTray fee
 * is platform-only and is never a shop expense, a shop credit, or a cut.
 *
 * Production (Vercel) environment variables — set these on Production.
 * Do not put client secrets in source:
 * - INTUIT_CLIENT_ID
 * - INTUIT_CLIENT_SECRET
 * - INTUIT_REDIRECT_URI   example: https://fixtray.app/api/shop/quickbooks/callback
 * - INTUIT_ENVIRONMENT    production | sandbox
 *
 * OAuth state is signed with JWT_SECRET (already required by shop login).
 */

import crypto from 'crypto';
import { auditEvent, shopReport, reportsMatchLedger, type BooksAuditEvent, type MonthClose, type ShopJob, type ShopLedger } from '@/lib/books/money';
import { laborPayCents } from '@/lib/books/clocks';
import { SHOP_PAID_IN_FULL_COPY, qbAccounts, type QbLabor, type QbMap, type QbReversal, type QbTax } from '@/lib/books/quickbooks';

export const QBO_PRODUCTION_ENV = [
  'INTUIT_CLIENT_ID',
  'INTUIT_CLIENT_SECRET',
  'INTUIT_REDIRECT_URI',
  'INTUIT_ENVIRONMENT',
] as const;

export const QBO_AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2';
export const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
export const QBO_SCOPE = 'com.intuit.quickbooks.accounting';
export const QBO_MINOR_VERSION = '75';

export const QBO_SYNC_COPY =
  'Sync sends shop sales, payments, refunds, and labor to QuickBooks Online. The FixTray fee stays on the platform and is not a shop expense.';

const MAP_KEYS: Array<keyof QbMap> = ['sales', 'payments', 'refunds', 'labor', 'parts', 'tax'];
const FORBIDDEN_MAP_KEYS = new Set(['fee', 'feeexpense', 'platformfee', 'fixtrayfee', 'fixtray']);

export type QboEnvironment = 'production' | 'sandbox';

export interface IntuitConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: QboEnvironment;
  apiHost: string;
}

export function qboApiHost(environment: QboEnvironment): string {
  return environment === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';
}

export function intuitConfig(env: NodeJS.ProcessEnv = process.env):
  | { ok: true; config: IntuitConfig }
  | { ok: false; missing: string[] } {
  const missing: string[] = [];
  const clientId = env.INTUIT_CLIENT_ID?.trim() || '';
  const clientSecret = env.INTUIT_CLIENT_SECRET?.trim() || '';
  const redirectUri = env.INTUIT_REDIRECT_URI?.trim() || '';
  const environmentRaw = env.INTUIT_ENVIRONMENT?.trim().toLowerCase() || '';
  if (!clientId) missing.push('INTUIT_CLIENT_ID');
  if (!clientSecret) missing.push('INTUIT_CLIENT_SECRET');
  if (!redirectUri) missing.push('INTUIT_REDIRECT_URI');
  if (environmentRaw !== 'production' && environmentRaw !== 'sandbox') missing.push('INTUIT_ENVIRONMENT');
  if (missing.length > 0) return { ok: false, missing };
  const environment = environmentRaw as QboEnvironment;
  return {
    ok: true,
    config: {
      clientId,
      clientSecret,
      redirectUri,
      environment,
      apiHost: qboApiHost(environment),
    },
  };
}

export function qboStateSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = env.JWT_SECRET?.trim();
  if (secret) return secret;
  if (env.NODE_ENV === 'production') return null;
  return env.JWT_DEV_SECRET?.trim() || 'dev-only-local-secret-change-in-production';
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function signQboState(input: { shopId: string; nowMs: number; secret: string; ttlMs?: number }): string {
  const shopId = input.shopId.trim();
  if (!shopId) throw new Error('shop id is required');
  if (!input.secret) throw new Error('state secret is required');
  const payload = {
    shopId,
    exp: input.nowMs + (input.ttlMs ?? 15 * 60 * 1000),
    n: crypto.randomBytes(16).toString('hex'),
  };
  const body = encodeJson(payload);
  const sig = crypto.createHmac('sha256', input.secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyQboState(state: string, secret: string, nowMs: number):
  | { ok: true; shopId: string }
  | { ok: false; error: string } {
  if (!secret) return { ok: false, error: 'state secret is required' };
  const [body, sig] = String(state || '').split('.');
  if (!body || !sig) return { ok: false, error: 'QuickBooks state is invalid' };
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return { ok: false, error: 'QuickBooks state is invalid' };
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { shopId?: unknown; exp?: unknown };
    if (typeof payload.shopId !== 'string' || !payload.shopId.trim()) {
      return { ok: false, error: 'QuickBooks state is invalid' };
    }
    if (typeof payload.exp !== 'number' || payload.exp < nowMs) {
      return { ok: false, error: 'QuickBooks connect expired. Start again.' };
    }
    return { ok: true, shopId: payload.shopId.trim() };
  } catch {
    return { ok: false, error: 'QuickBooks state is invalid' };
  }
}

export function qboAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(QBO_AUTHORIZE_URL);
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', QBO_SCOPE);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('state', input.state);
  return url.toString();
}

export function isQboRealmId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9]{1,20}$/.test(value);
}

function normalizeMapKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z]/g, '');
}

/** Shop map is the six job accounts. A FixTray fee account is rejected. */
export function qboAccountMap(input: Record<string, unknown> | null | undefined):
  | { ok: true; map: QbMap }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Account map is required' };
  }
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_MAP_KEYS.has(normalizeMapKey(key))) {
      return { ok: false, error: 'The FixTray fee is not a shop QuickBooks account' };
    }
  }
  const map = {} as QbMap;
  for (const key of MAP_KEYS) {
    const value = input[key];
    if (typeof value !== 'string' || !value.trim()) {
      return { ok: false, error: `Map the ${key} account` };
    }
    map[key] = value.trim();
  }
  const sanitized = qbAccounts(map);
  return { ok: true, map: sanitized };
}

export interface QboTokenRequest {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: string;
}

export function qboTokenRequest(input: {
  clientId: string;
  clientSecret: string;
  grant:
    | { type: 'authorization_code'; code: string; redirectUri: string }
    | { type: 'refresh_token'; refreshToken: string };
}): QboTokenRequest {
  const params = new URLSearchParams();
  if (input.grant.type === 'authorization_code') {
    params.set('grant_type', 'authorization_code');
    params.set('code', input.grant.code);
    params.set('redirect_uri', input.grant.redirectUri);
  } else {
    params.set('grant_type', 'refresh_token');
    params.set('refresh_token', input.grant.refreshToken);
  }
  const basic = Buffer.from(`${input.clientId}:${input.clientSecret}`).toString('base64');
  return {
    url: QBO_TOKEN_URL,
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: params.toString(),
  };
}

export function parseQboTokenResponse(payload: unknown):
  | { ok: true; accessToken: string; refreshToken: string; expiresIn: number }
  | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'QuickBooks token response was empty' };
  const row = payload as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown; error?: unknown };
  if (typeof row.error === 'string' && row.error) return { ok: false, error: 'QuickBooks did not grant access' };
  if (typeof row.access_token !== 'string' || !row.access_token) return { ok: false, error: 'QuickBooks did not grant access' };
  if (typeof row.refresh_token !== 'string' || !row.refresh_token) return { ok: false, error: 'QuickBooks did not grant access' };
  const expiresIn = typeof row.expires_in === 'number' && row.expires_in > 0 ? row.expires_in : 3600;
  return { ok: true, accessToken: row.access_token, refreshToken: row.refresh_token, expiresIn };
}

export async function requestQboToken(input: {
  clientId: string;
  clientSecret: string;
  grant: Parameters<typeof qboTokenRequest>[0]['grant'];
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; accessToken: string; refreshToken: string; expiresIn: number } | { ok: false; error: string }> {
  const request = qboTokenRequest(input);
  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(request.url, { method: request.method, headers: request.headers, body: request.body });
  } catch {
    return { ok: false, error: 'QuickBooks token request failed' };
  }
  const payload = await response.json().catch(() => null);
  const parsed = parseQboTokenResponse(payload);
  if (!response.ok || !parsed.ok) return { ok: false, error: 'QuickBooks did not grant access' };
  return parsed;
}

export function qboCompanyUrl(apiHost: string, realmId: string, pathAndQuery: string): string {
  if (!isQboRealmId(realmId)) throw new Error('QuickBooks company id is invalid');
  const host = apiHost.replace(/\/+$/, '');
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  return `${host}/v3/company/${realmId}${path}`;
}

export interface QboAccountChoice {
  id: string;
  name: string;
  accountType: string;
}

export function qboAccountQueryUrl(apiHost: string, realmId: string): string {
  const query = 'select Id, Name, AccountType from Account where Active = true maxresults 1000';
  return qboCompanyUrl(apiHost, realmId, `/query?query=${encodeURIComponent(query)}&minorversion=${QBO_MINOR_VERSION}`);
}

export function parseQboAccounts(payload: unknown): QboAccountChoice[] {
  const accounts = payload && typeof payload === 'object'
    ? (payload as { QueryResponse?: { Account?: unknown } }).QueryResponse?.Account
    : null;
  if (!Array.isArray(accounts)) return [];
  const choices: QboAccountChoice[] = [];
  for (const row of accounts) {
    if (!row || typeof row !== 'object') continue;
    const account = row as { Id?: unknown; Name?: unknown; AccountType?: unknown };
    if (typeof account.Id !== 'string' || !account.Id.trim()) continue;
    if (typeof account.Name !== 'string' || !account.Name.trim()) continue;
    choices.push({
      id: account.Id.trim(),
      name: account.Name.trim(),
      accountType: typeof account.AccountType === 'string' ? account.AccountType : '',
    });
  }
  return choices;
}

export type QboSyncKind = 'sales' | 'payment' | 'refund' | 'labor' | 'parts' | 'tax';

export interface QboJournalLine {
  kind: QboSyncKind;
  posting: 'Credit' | 'Debit';
  accountId: string;
  amountCents: number;
}

export interface QboSyncRequest {
  entity: 'JournalEntry' | 'TimeActivity';
  idempotencyKey: string;
  docNumber: string;
  amountCents: number;
  lines: QboJournalLine[];
  body: Record<string, unknown>;
}

export interface QboSyncTotals {
  salesCents: number;
  paymentsCents: number;
  refundsCents: number;
  laborCents: number;
  partsCents: number;
  taxCents: number;
  netShopCents: number;
}

export interface QboPartLine {
  workOrderId: string;
  amountCents: number;
}

function dollars(cents: number): number {
  return Math.round(cents) / 100;
}

function docNumber(idempotencyKey: string): string {
  const hash = crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 19);
  return `FT${hash}`;
}

function txnDate(value: string | null | undefined, month: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (/^\d{4}-\d{2}$/.test(month)) return `${month}-01`;
  return '1970-01-01';
}

function journalLine(input: QboJournalLine & { description: string }): Record<string, unknown> {
  return {
    Description: input.description,
    Amount: dollars(input.amountCents),
    DetailType: 'JournalEntryLineDetail',
    JournalEntryLineDetail: {
      PostingType: input.posting,
      AccountRef: { value: input.accountId },
    },
  };
}

function postedJobReversal(reversal: QbReversal): boolean {
  return reversal.appliesTo === 'job'
    && reversal.amountCents > 0
    && String(reversal.status || 'posted') !== 'open';
}

export function buildQboSyncBatch(input: {
  shopId: string;
  month: string;
  jobs: ShopJob[];
  reversals: QbReversal[];
  labor: QbLabor[];
  parts?: QboPartLine[];
  tax?: QbTax[];
  map: QbMap | Record<string, unknown> | null;
  close?: MonthClose;
}):
  | { ok: true; requests: QboSyncRequest[]; totals: QboSyncTotals; map: QbMap; copy: string }
  | { ok: false; blocked: true; warnings: string[]; requests: []; copy: string } {
  const copy = QBO_SYNC_COPY;
  const close = input.close;
  if (close && !close.readyToSync) {
    return { ok: false, blocked: true, warnings: close.warnings, requests: [], copy };
  }
  const mapped = qboAccountMap(input.map as Record<string, unknown>);
  if (!mapped.ok) {
    return { ok: false, blocked: true, warnings: [mapped.error], requests: [], copy };
  }
  const map = mapped.map;
  const requests: QboSyncRequest[] = [];
  const totals: QboSyncTotals = {
    salesCents: 0,
    paymentsCents: 0,
    refundsCents: 0,
    laborCents: 0,
    partsCents: 0,
    taxCents: 0,
    netShopCents: 0,
  };
  const partsByJob = new Map<string, number>();
  for (const row of input.parts || []) {
    if (row.amountCents > 0) partsByJob.set(row.workOrderId, (partsByJob.get(row.workOrderId) || 0) + row.amountCents);
  }
  const taxByJob = new Map<string, number>();
  for (const row of input.tax || []) {
    if (row.taxCents > 0) taxByJob.set(row.workOrderId, (taxByJob.get(row.workOrderId) || 0) + row.taxCents);
  }
  const refundsByJob = new Map<string, QbReversal[]>();
  const unallocated: QbReversal[] = [];
  for (const reversal of input.reversals) {
    if (!postedJobReversal(reversal)) continue;
    const workOrderId = reversal.workOrderId?.trim();
    if (!workOrderId) {
      unallocated.push(reversal);
      continue;
    }
    const list = refundsByJob.get(workOrderId) || [];
    list.push(reversal);
    refundsByJob.set(workOrderId, list);
  }

  const pushJournal = (key: string, date: string, lines: Array<QboJournalLine & { description: string }>) => {
    const amountCents = lines.reduce((sum, line) => sum + (line.posting === 'Debit' ? line.amountCents : 0), 0);
    const body = {
      TxnDate: date,
      PrivateNote: key,
      DocNumber: docNumber(key),
      Line: lines.map(journalLine),
    };
    requests.push({
      entity: 'JournalEntry',
      idempotencyKey: key,
      docNumber: docNumber(key),
      amountCents,
      lines: lines.map(({ kind, posting, accountId, amountCents: cents }) => ({ kind, posting, accountId, amountCents: cents })),
      body,
    });
    for (const line of lines) {
      if (line.kind === 'sales' && line.posting === 'Credit') totals.salesCents += line.amountCents;
      if (line.kind === 'parts' && line.posting === 'Credit') {
        totals.partsCents += line.amountCents;
        totals.salesCents += line.amountCents;
      }
      if (line.kind === 'tax' && line.posting === 'Credit') {
        totals.taxCents += line.amountCents;
        totals.salesCents += line.amountCents;
      }
      if (line.kind === 'payment' && line.posting === 'Debit') totals.paymentsCents += line.amountCents;
      if (line.kind === 'refund' && line.posting === 'Debit') totals.refundsCents += line.amountCents;
    }
  };

  const pushJob = (job: ShopJob, refunds: QbReversal[]) => {
    const refundCents = refunds.reduce((sum, reversal) => sum + reversal.amountCents, 0);
    const gross = job.shopReceivedCents + refundCents;
    if (gross <= 0) return;
    let room = gross;
    const taxTake = Math.min(Math.max(0, taxByJob.get(job.id) || 0), room);
    room -= taxTake;
    const partsTake = Math.min(Math.max(0, partsByJob.get(job.id) || 0), room);
    room -= partsTake;
    const salesTake = room;
    const lines: Array<QboJournalLine & { description: string }> = [
      { kind: 'payment', posting: 'Debit', accountId: map.payments, amountCents: gross, description: 'Shop payment' },
    ];
    if (salesTake > 0) lines.push({ kind: 'sales', posting: 'Credit', accountId: map.sales, amountCents: salesTake, description: 'Shop job' });
    if (partsTake > 0) lines.push({ kind: 'parts', posting: 'Credit', accountId: map.parts, amountCents: partsTake, description: 'Shop parts' });
    if (taxTake > 0) lines.push({ kind: 'tax', posting: 'Credit', accountId: map.tax, amountCents: taxTake, description: 'Sales tax' });
    pushJournal(
      `ft:${input.shopId}:${input.month}:job:${job.id}`,
      txnDate(job.depositAt, input.month),
      lines,
    );
    for (const reversal of refunds) {
      pushJournal(
        `ft:${input.shopId}:${input.month}:refund:${reversal.id}`,
        txnDate(reversal.at, input.month),
        [
          { kind: 'refund', posting: 'Debit', accountId: map.refunds, amountCents: reversal.amountCents, description: 'Shop job refund' },
          { kind: 'payment', posting: 'Credit', accountId: map.payments, amountCents: reversal.amountCents, description: 'Shop job refund' },
        ],
      );
    }
  };

  for (const job of input.jobs) {
    pushJob(job, refundsByJob.get(job.id) || []);
  }
  for (const reversal of unallocated) {
    pushJournal(
      `ft:${input.shopId}:${input.month}:refund:${reversal.id}`,
      txnDate(reversal.at, input.month),
      [
        { kind: 'payment', posting: 'Debit', accountId: map.payments, amountCents: reversal.amountCents, description: 'Shop payment' },
        { kind: 'sales', posting: 'Credit', accountId: map.sales, amountCents: reversal.amountCents, description: 'Shop job' },
        { kind: 'refund', posting: 'Debit', accountId: map.refunds, amountCents: reversal.amountCents, description: 'Shop job refund' },
        { kind: 'payment', posting: 'Credit', accountId: map.payments, amountCents: reversal.amountCents, description: 'Shop job refund' },
      ],
    );
  }

  for (const row of input.labor) {
    const pay = laborPayCents(row.minutes, row.hourlyRateCents);
    if (row.minutes <= 0 || pay <= 0) continue;
    const key = `ft:${input.shopId}:${input.month}:labor:${row.personId}`;
    const hours = Math.floor(row.minutes / 60);
    const minutes = row.minutes % 60;
    requests.push({
      entity: 'TimeActivity',
      idempotencyKey: key,
      docNumber: docNumber(key),
      amountCents: pay,
      lines: [{ kind: 'labor', posting: 'Debit', accountId: map.labor, amountCents: pay }],
      body: {
        TxnDate: txnDate(null, input.month),
        NameOf: 'Employee',
        Hours: hours,
        Minutes: minutes,
        HourlyRate: dollars(row.hourlyRateCents),
        Description: 'Shop labor',
        BillableStatus: 'NotBillable',
      },
    });
    totals.laborCents += pay;
  }

  totals.netShopCents = totals.paymentsCents - totals.refundsCents;
  return { ok: true, requests, totals, map, copy };
}

export function syncMatchesLedger(totals: QboSyncTotals, ledger: ShopLedger): boolean {
  const report = shopReport(ledger);
  return totals.netShopCents === ledger.shopReceivedCents
    && totals.netShopCents === ledger.customerPaidJobCents
    && totals.netShopCents === ledger.shopTotalCents
    && totals.paymentsCents - totals.refundsCents === ledger.shopReceivedCents
    && totals.salesCents - totals.refundsCents === ledger.shopReceivedCents
    && ledger.feeDeductedFromShop === false
    && reportsMatchLedger(ledger, report);
}

export function qboAudit(input: {
  actorId: string;
  at: string;
  shopId: string;
  action: 'books.quickbooks_connect' | 'books.quickbooks_map' | 'books.quickbooks_sync';
  details: string;
}): BooksAuditEvent {
  return auditEvent({
    actorId: input.actorId,
    at: input.at,
    action: input.action,
    targetType: 'integration',
    targetId: input.shopId,
    shopId: input.shopId,
    details: `${input.details}; at ${input.at}; ${SHOP_PAID_IN_FULL_COPY}`,
  });
}

function faultMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const errors = (payload as { Fault?: { Error?: Array<{ Message?: unknown; Detail?: unknown }> } }).Fault?.Error;
  const first = Array.isArray(errors) ? errors[0] : null;
  const message = typeof first?.Message === 'string' ? first.Message : typeof first?.Detail === 'string' ? first.Detail : '';
  return message ? message.slice(0, 300) : null;
}

function entityId(payload: unknown, entity: 'JournalEntry' | 'TimeActivity'): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const row = (payload as Record<string, { Id?: unknown }>)[entity];
  return row && typeof row.Id === 'string' && row.Id ? row.Id : null;
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export async function postQboSyncBatch(input: {
  apiHost: string;
  realmId: string;
  accessToken: string;
  requests: QboSyncRequest[];
  alreadyPosted?: Record<string, string>;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; posted: Record<string, string> } | { ok: false; error: string; posted: Record<string, string> }> {
  if (!isQboRealmId(input.realmId)) return { ok: false, error: 'QuickBooks company id is invalid', posted: {} };
  const fetchImpl = input.fetchImpl ?? fetch;
  const posted: Record<string, string> = { ...(input.alreadyPosted || {}) };
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${input.accessToken}`,
  };
  for (const request of input.requests) {
    if (posted[request.idempotencyKey]) continue;
    if (request.entity === 'JournalEntry' && /^FT[0-9a-f]+$/.test(request.docNumber)) {
      const query = `select Id from JournalEntry where DocNumber = '${request.docNumber}'`;
      const queryUrl = qboCompanyUrl(input.apiHost, input.realmId, `/query?query=${encodeURIComponent(query)}&minorversion=${QBO_MINOR_VERSION}`);
      try {
        const existing = await fetchImpl(queryUrl, { method: 'GET', headers });
        const existingBody = await readJson(existing);
        const rows = existingBody && typeof existingBody === 'object'
          ? (existingBody as { QueryResponse?: { JournalEntry?: Array<{ Id?: string }> | { Id?: string } } }).QueryResponse?.JournalEntry
          : null;
        const first = Array.isArray(rows) ? rows[0] : rows;
        if (existing.ok && first && typeof first.Id === 'string' && first.Id) {
          posted[request.idempotencyKey] = first.Id;
          continue;
        }
      } catch {
        return { ok: false, error: 'QuickBooks query failed', posted };
      }
    }
    const path = request.entity === 'JournalEntry' ? 'journalentry' : 'timeactivity';
    const url = qboCompanyUrl(input.apiHost, input.realmId, `/${path}?minorversion=${QBO_MINOR_VERSION}`);
    let response: Response;
    try {
      response = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(request.body) });
    } catch {
      return { ok: false, error: 'QuickBooks sync failed', posted };
    }
    const payload = await readJson(response);
    const id = entityId(payload, request.entity);
    if (!response.ok || !id) {
      return { ok: false, error: faultMessage(payload) || 'QuickBooks sync failed', posted };
    }
    posted[request.idempotencyKey] = id;
  }
  return { ok: true, posted };
}
