/**
 * One shop-money calculation for dashboard, Books, ledger, reports, EOD,
 * AR, profit, and the statements. Amounts are integer cents.
 *
 * The shop job never includes the customer FixTray fee. A payment with no
 * invoice is flagged and becomes customer credit. Accounts receivable is
 * never negative: an overpayment is customer credit.
 */

import { dayKey } from '@/lib/books/periods';

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
}

export interface ShopJobFacts {
  id: string;
  customerId?: string | null;
  status?: string | null;
  completedAt?: string | null;
  /** Null when the job was never invoiced. */
  invoiceCents: number | null;
  invoiceAt?: string | null;
  /** Parts sell cents inside the invoice. Labor is the rest. */
  partsSellCents?: number;
  /** Tax frozen at invoice. Absent means use the owner's current settings. */
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

function inWindow(at: string, start: Date, end: Date): boolean {
  const time = new Date(at).getTime();
  return Number.isFinite(time) && time >= start.getTime() && time < end.getTime();
}

export function positionJob(job: ShopJobFacts): JobPosition {
  const missingInvoice = job.invoiceCents == null;
  const invoicedCents = missingInvoice ? 0 : whole(job.invoiceCents as number);
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
  let arCents = 0;
  let customerCreditCents = 0;
  let appliedCents = 0;
  if (missingInvoice) {
    customerCreditCents = Math.max(0, netPaid);
  } else if (netPaid > invoicedCents) {
    appliedCents = invoicedCents;
    customerCreditCents = netPaid - invoicedCents;
    flags.push('overpayment');
  } else if (netPaid >= 0) {
    appliedCents = netPaid;
    arCents = invoicedCents - netPaid;
  } else {
    appliedCents = 0;
    arCents = invoicedCents - netPaid;
  }
  return {
    workOrderId: job.id,
    invoicedCents,
    paidCents,
    refundCents,
    chargebackCents,
    depositCents,
    voidCents,
    appliedCents,
    arCents,
    customerCreditCents,
    revenueCents: netPaid,
    missingInvoice,
    flags,
  };
}

export function positionJobs(jobs: ShopJobFacts[]): JobPosition[] {
  return jobs.map(positionJob);
}

function eventsInRange(jobs: ShopJobFacts[], start: Date, end: Date): ShopMoneyEvent[] {
  return jobs.flatMap((job) => job.events.filter((event) => inWindow(event.at, start, end)));
}

/**
 * Period activity plus the open AR and credit of these jobs.
 * Revenue is shop job cash in the range and does not include the FixTray fee.
 */
export function rangeSnapshot(jobs: ShopJobFacts[], start: Date, end: Date): RangeSnapshot {
  const positions = positionJobs(jobs);
  const events = eventsInRange(jobs, start, end);
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
    if (inWindow(job.completedAt, start, end)) snapshot.completedCount += 1;
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
    const invoiceDay = invoiceAt ? dayKey(new Date(invoiceAt), timeZone) : dayKey(asOf, timeZone);
    const asOfDay = dayKey(asOf, timeZone);
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
