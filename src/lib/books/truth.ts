/**
 * One shop-money calculation for dashboard, Books, ledger, reports, EOD,
 * AR, profit, and the statements. Amounts are integer cents.
 *
 * The shop job never includes the customer FixTray fee. Customer credit is
 * only a payment that is more than the invoice. A deposit row is not extra
 * cash. A paid job with no invoice record is not credit. Estimates are not
 * accounts receivable. Accounts receivable is never negative.
 */

import { booksDayKey, reportTimeZone } from '@/lib/books/periods';

export const COMPLETED_STATUSES = new Set(['closed', 'completed']);

export type JobPayMethod = 'card' | 'cash' | 'check' | 'other' | 'transfer';

export interface ShopMoneyEvent {
  id: string;
  workOrderId: string;
  at: string;
  kind: 'invoice' | 'payment' | 'refund' | 'chargeback' | 'deposit' | 'void';
  /** Shop job cents. The FixTray fee is not included. */
  cents: number;
  method?: JobPayMethod;
  /** Sales tax included in an invoice's cents. Zero unless the owner set a rate. */
  taxCents?: number;
  /** Books note. Counter receipts say "shop receipt" and are not bank deposits. */
  note?: string | null;
}

export interface ShopJobFacts {
  id: string;
  customerId?: string | null;
  status?: string | null;
  completedAt?: string | null;
  /** Null when the job was never invoiced. Estimates stay null. */
  invoiceCents: number | null;
  /**
   * False when the money invoice comes from the job status but there is no
   * status history or payment link yet. The create-invoice action still shows.
   */
  invoiceRecorded?: boolean;
  invoiceAt?: string | null;
  /** Parts sell cents inside the invoice. Labor is the rest. */
  partsSellCents?: number;
  /** Tax frozen at invoice. Absent means this invoice has no tax. */
  salesTax?: {
    ratePercent: number;
    laborTaxable: boolean;
    partsTaxable: boolean;
    laborCents: number;
    partsCents: number;
    taxCents: number;
    frozenAt: string;
  } | null;
  events: ShopMoneyEvent[];
}

export interface JobPosition {
  workOrderId: string;
  invoicedCents: number;
  paidCents: number;
  refundCents: number;
  chargebackCents: number;
  depositCents: number;
  voidCents: number;
  appliedCents: number;
  arCents: number;
  customerCreditCents: number;
  /** Shop cash for the job: payments minus refunds and chargebacks. Fee excluded. */
  revenueCents: number;
  missingInvoice: boolean;
  flags: string[];
}

export interface RangeSnapshot {
  invoicedCents: number;
  paidCents: number;
  refundCents: number;
  chargebackCents: number;
  depositCents: number;
  voidCents: number;
  /** Cash shop revenue in the range. Fee excluded. */
  revenueCents: number;
  /** Open job balances. Never negative. */
  arCents: number;
  customerCreditCents: number;
  cardCents: number;
  cashCents: number;
  checkCents: number;
  otherCents: number;
  transferCents: number;
  completedCount: number;
  flags: string[];
}

function whole(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.max(0, Math.round(cents));
}

/** Shop day of an event, compared to the shop days of the window edges. */
export function civilInRange(at: string, start: Date, end: Date, timeZone: string): boolean {
  const instant = new Date(at);
  if (Number.isNaN(instant.getTime())) return false;
  const zone = reportTimeZone(timeZone);
  const day = booksDayKey(instant, zone);
  const startDay = booksDayKey(start, zone);
  const endDay = booksDayKey(end, zone);
  return day >= startDay && day < endDay;
}

/**
 * Accounts receivable and customer credit for one job.
 * Credit is only payments above the invoice. Deposit rows, including a
 * running total saved on top of the payment, are not customer money.
 * No invoice means no credit and no AR. The two balances are never netted.
 */
export function jobBalance(input: {
  invoiceCents: number | null;
  paidCents: number;
  refundCents: number;
  chargebackCents: number;
  depositCents: number;
}): { arCents: number; customerCreditCents: number; collectedCents: number } {
  const paid = whole(input.paidCents);
  const refund = whole(input.refundCents);
  const chargeback = whole(input.chargebackCents);
  const netPaid = paid - refund - chargeback;
  const collected = Math.max(0, netPaid);
  if (input.invoiceCents == null) {
    return { arCents: 0, customerCreditCents: 0, collectedCents: collected };
  }
  const invoiced = whole(input.invoiceCents);
  if (collected > invoiced) {
    return { arCents: 0, customerCreditCents: collected - invoiced, collectedCents: collected };
  }
  return {
    arCents: Math.max(0, invoiced - collected),
    customerCreditCents: 0,
    collectedCents: collected,
  };
}

export function isStillOpenStatus(status: string | null | undefined): boolean {
  const value = String(status || '').trim().toLowerCase();
  return value !== 'closed' && value !== 'completed' && value !== 'denied-estimate';
}

export function positionJob(job: ShopJobFacts): JobPosition {
  const formalMissing = job.invoiceRecorded === false;
  const missingInvoice = job.invoiceCents == null || formalMissing;
  const invoicedCents = job.invoiceCents == null ? 0 : whole(job.invoiceCents);
  let paidCents = 0;
  let refundCents = 0;
  let chargebackCents = 0;
  let depositCents = 0;
  let voidCents = 0;
  for (const event of job.events) {
    if (event.workOrderId !== job.id) continue;
    const cents = whole(event.cents);
    if (event.kind === 'payment') paidCents += cents;
    else if (event.kind === 'refund') refundCents += cents;
    else if (event.kind === 'chargeback') chargebackCents += cents;
    else if (event.kind === 'deposit') depositCents += cents;
    else if (event.kind === 'void') voidCents += cents;
  }
  const netPaid = paidCents - refundCents - chargebackCents;
  const flags: string[] = [];
  if (missingInvoice && (paidCents > 0 || refundCents > 0 || chargebackCents > 0)) {
    flags.push('missing_invoice');
    flags.push('payment_without_invoice');
  }
  const balance = jobBalance({
    invoiceCents: job.invoiceCents == null ? null : invoicedCents,
    paidCents,
    refundCents,
    chargebackCents,
    depositCents,
  });
  if (!missingInvoice && balance.customerCreditCents > 0) flags.push('overpayment');
  return {
    workOrderId: job.id,
    invoicedCents,
    paidCents,
    refundCents,
    chargebackCents,
    depositCents,
    voidCents,
    appliedCents: Math.min(balance.collectedCents, invoicedCents),
    arCents: balance.arCents,
    customerCreditCents: balance.customerCreditCents,
    revenueCents: netPaid,
    missingInvoice,
    flags,
  };
}

export function positionJobs(jobs: ShopJobFacts[]): JobPosition[] {
  return jobs.map(positionJob);
}

function eventsInRange(jobs: ShopJobFacts[], start: Date, end: Date, timeZone: string): ShopMoneyEvent[] {
  return jobs.flatMap((job) => job.events.filter((event) => civilInRange(event.at, start, end, timeZone)));
}

/**
 * Period activity plus the open AR and credit of these jobs.
 * Revenue is shop job cash in the range and does not include the FixTray fee.
 * AR and customer credit are each job's own balance. They are not netted.
 */
export function rangeSnapshot(jobs: ShopJobFacts[], start: Date, end: Date, timeZone = 'America/New_York'): RangeSnapshot {
  const zone = reportTimeZone(timeZone);
  const positions = positionJobs(jobs);
  const events = eventsInRange(jobs, start, end, zone);
  const snapshot: RangeSnapshot = {
    invoicedCents: 0,
    paidCents: 0,
    refundCents: 0,
    chargebackCents: 0,
    depositCents: 0,
    voidCents: 0,
    revenueCents: 0,
    arCents: positions.reduce((sum, job) => sum + job.arCents, 0),
    customerCreditCents: positions.reduce((sum, job) => sum + job.customerCreditCents, 0),
    cardCents: 0,
    cashCents: 0,
    checkCents: 0,
    otherCents: 0,
    transferCents: 0,
    completedCount: 0,
    flags: [...new Set(positions.flatMap((job) => job.flags))].sort(),
  };
  for (const event of events) {
    const cents = whole(event.cents);
    if (event.kind === 'invoice') snapshot.invoicedCents += cents;
    else if (event.kind === 'payment') {
      snapshot.paidCents += cents;
      if (event.method === 'card') snapshot.cardCents += cents;
      else if (event.method === 'cash') snapshot.cashCents += cents;
      else if (event.method === 'check') snapshot.checkCents += cents;
      else if (event.method === 'transfer') snapshot.transferCents += cents;
      else snapshot.otherCents += cents;
    } else if (event.kind === 'refund') snapshot.refundCents += cents;
    else if (event.kind === 'chargeback') snapshot.chargebackCents += cents;
    else if (event.kind === 'deposit') snapshot.depositCents += cents;
    else if (event.kind === 'void') snapshot.voidCents += cents;
  }
  snapshot.revenueCents = snapshot.paidCents - snapshot.refundCents - snapshot.chargebackCents;
  for (const job of jobs) {
    if (!job.completedAt || !COMPLETED_STATUSES.has(String(job.status || '').trim().toLowerCase())) continue;
    if (civilInRange(job.completedAt, start, end, zone)) snapshot.completedCount += 1;
  }
  if (snapshot.arCents < 0) snapshot.arCents = 0;
  return snapshot;
}

export interface AgingBucket {
  workOrderId: string;
  arCents: number;
  ageDays: number;
  bucket: 'current' | '30' | '60' | '90';
  flags: string[];
}

/** Open AR by invoice age. Jobs with no balance are omitted. AR on each row is >= 0. */
export function arAging(jobs: ShopJobFacts[], asOf: Date, timeZone: string): AgingBucket[] {
  const rows: AgingBucket[] = [];
  for (const job of jobs) {
    const position = positionJob(job);
    if (position.arCents <= 0) continue;
    const invoiceAt = job.invoiceAt || job.events.find((event) => event.kind === 'invoice')?.at;
    const invoiceDay = invoiceAt ? booksDayKey(new Date(invoiceAt), timeZone) : booksDayKey(asOf, timeZone);
    const asOfDay = booksDayKey(asOf, timeZone);
    const ageDays = Math.max(0, Math.round((new Date(`${asOfDay}T00:00:00.000Z`).getTime() - new Date(`${invoiceDay}T00:00:00.000Z`).getTime()) / 86400000));
    const bucket = ageDays <= 30 ? 'current' : ageDays <= 60 ? '30' : ageDays <= 90 ? '60' : '90';
    rows.push({ workOrderId: job.id, arCents: position.arCents, ageDays, bucket, flags: position.flags });
  }
  return rows.sort((a, b) => b.ageDays - a.ageDays || a.workOrderId.localeCompare(b.workOrderId));
}

export function payMethodFromNote(note: string | null | undefined): JobPayMethod {
  const text = String(note || '').toLowerCase();
  if (text.includes('check')) return 'check';
  if (text.includes('card')) return 'card';
  if (text.includes('transfer')) return 'transfer';
  if (text.includes('cash')) return 'cash';
  if (text.includes('other')) return 'other';
  return 'other';
}
