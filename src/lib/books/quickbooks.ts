/**
 * QuickBooks handoff. QuickBooks still owns the full books.
 * The file lists shop sales, payments, job refunds, and labor.
 * The FixTray fee is not a row and is not a shop expense.
 */

import { auditEvent, monthClose, type BooksAuditEvent, type MonthClose, type ShopJob } from '@/lib/books/money';
import { laborPayCents } from '@/lib/books/clocks';

export const SHOP_PAID_IN_FULL_COPY =
  'The shop is paid in full for the job. The FixTray fee is separate and is not taken from the shop.';

export const QUICKBOOKS_OWNS_BOOKS_COPY =
  'QuickBooks still owns the full books. This file hands off sales, payments, refunds, and labor.';

export interface QbMap {
  sales: string;
  payments: string;
  refunds: string;
  labor: string;
  parts: string;
  tax: string;
}

export const DEFAULT_QB_MAP: QbMap = {
  sales: 'Sales',
  payments: 'Undeposited Funds',
  refunds: 'Sales',
  labor: 'Shop Labor',
  parts: 'Parts Income',
  tax: 'Sales Tax Payable',
};

const MAP_KEYS: Array<keyof QbMap> = ['sales', 'payments', 'refunds', 'labor', 'parts', 'tax'];

export function qbAccounts(input?: Partial<QbMap> | Record<string, unknown> | null): QbMap {
  const map = { ...DEFAULT_QB_MAP };
  if (!input) return map;
  for (const key of MAP_KEYS) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) map[key] = value.trim();
  }
  return map;
}

export interface QbReversal {
  id: string;
  appliesTo: 'job' | 'fee';
  kind: 'refund' | 'chargeback';
  amountCents: number;
  at: string;
  status?: string | null;
}

export interface QbLabor {
  personId: string;
  minutes: number;
  hourlyRateCents: number;
}

export interface QbTax {
  workOrderId: string;
  taxCents: number;
}

function csvField(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function quickBooksHandoff(input: {
  jobs: ShopJob[];
  reversals: QbReversal[];
  labor: QbLabor[];
  tax?: QbTax[];
  map?: QbMap | Record<string, unknown> | null;
  close?: MonthClose;
}):
  | { ok: true; csv: string; copy: string; ownsBooks: string; map: QbMap }
  | { ok: false; blocked: true; warnings: string[]; copy: string; ownsBooks: string } {
  const close = input.close ?? monthClose(input.jobs);
  const copy = SHOP_PAID_IN_FULL_COPY;
  const ownsBooks = QUICKBOOKS_OWNS_BOOKS_COPY;
  if (!close.readyToSync) {
    return { ok: false, blocked: true, warnings: close.warnings, copy, ownsBooks };
  }
  const map = qbAccounts(input.map);
  const lines = [
    `# ${copy}`,
    `# ${ownsBooks}`,
    'section,date,name,account,amount_cents,memo',
  ];
  for (const job of input.jobs) {
    if (job.jobCents <= 0) continue;
    lines.push([
      'sales',
      job.depositAt || '',
      job.id,
      map.sales,
      job.jobCents,
      'shop job',
    ].map(csvField).join(','));
    if (job.shopReceivedCents > 0) {
      lines.push([
        'payment',
        job.depositAt || '',
        job.id,
        map.payments,
        job.shopReceivedCents,
        'shop received',
      ].map(csvField).join(','));
    }
  }
  for (const reversal of input.reversals) {
    if (reversal.appliesTo !== 'job') continue;
    if (String(reversal.status || 'posted') === 'open') continue;
    lines.push([
      reversal.kind,
      reversal.at,
      reversal.id,
      map.refunds,
      reversal.amountCents,
      'shop job reversal',
    ].map(csvField).join(','));
  }
  for (const row of input.labor) {
    lines.push([
      'labor',
      '',
      row.personId,
      map.labor,
      laborPayCents(row.minutes, row.hourlyRateCents),
      `${row.minutes} minutes`,
    ].map(csvField).join(','));
  }
  for (const row of input.tax || []) {
    if (row.taxCents <= 0) continue;
    lines.push(['tax', '', row.workOrderId, map.tax, row.taxCents, 'sales tax'].map(csvField).join(','));
  }
  return {
    ok: true,
    csv: `${lines.join('\n')}\n`,
    copy,
    ownsBooks,
    map,
  };
}

export function quickBooksExportAudit(input: {
  actorId: string;
  at: string;
  shopId: string;
  rowCount: number;
}): BooksAuditEvent {
  return auditEvent({
    actorId: input.actorId,
    at: input.at,
    action: 'books.quickbooks_export',
    targetType: 'shop_books',
    targetId: input.shopId,
    shopId: input.shopId,
    details: `exported ${input.rowCount} rows; fee excluded`,
  });
}
