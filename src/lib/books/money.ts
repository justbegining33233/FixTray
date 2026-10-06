import { customerFacingServiceFeeCents } from '@/lib/serviceFeeBill';

/**
 * Shop job money and the platform fee ledger.
 *
 * The shop is paid the full job. The customer FixTray fee is platform-only.
 * It is never subtracted from shop received, never treated as a shop expense,
 * and never mixed into the shop "customer paid" figure. Customer paid for the
 * job and shop received are the same cents.
 *
 * Amounts are integer cents so a refund or a chargeback cannot drift by a fraction of a cent.
 */

export type PaymentStanding = 'unpaid' | 'partial' | 'paid' | 'reversed';

export interface BooksAuditEvent {
  actorId: string;
  at: string;
  action: string;
  targetType: string;
  targetId: string;
  shopId: string | null;
  details: string;
}

export interface BooksEntryDraft {
  kind: 'card_payment' | 'job_payment' | 'deposit' | 'refund' | 'chargeback' | 'fee_settlement';
  appliesTo: 'job' | 'fee';
  amountCents: number;
  status: 'posted' | 'open';
  idempotencyKey: string;
  sourceId: string | null;
  depositAt: string | null;
  note: string | null;
}

export interface ShopJob {
  id: string;
  shopId: string;
  jobCents: number;
  customerPaidJobCents: number;
  shopReceivedCents: number;
  platformFeeCents: number;
  cardJobCents: number;
  depositCents: number | null;
  depositAt: string | null;
  openReversalIds: string[];
  standing: PaymentStanding;
}

export interface StandingBuckets {
  unpaid: { count: number; remainingCents: number };
  partial: { count: number; remainingCents: number; paidCents: number };
  paid: { count: number; paidCents: number };
  reversed: { count: number; reversedCents: number };
}

export interface ShopLedger {
  jobs: ShopJob[];
  customerPaidJobCents: number;
  shopReceivedCents: number;
  platformFeeCents: number;
  /** Shop total is shop received. The fee is not deducted. */
  shopTotalCents: number;
  feeDeductedFromShop: false;
  standing: StandingBuckets;
}

export interface ShopReport {
  customerPaidJobCents: number;
  shopReceivedCents: number;
  shopTotalCents: number;
  unpaidCents: number;
  partialCents: number;
  paidCents: number;
  platformFeeCents: number;
  feeDeductedFromShop: false;
}

export interface OrderInput {
  id: string;
  shopId: string;
  estimatedCost?: number | null;
  amountPaid?: number | null;
  paymentStatus?: string | null;
  createdAt?: string | Date | null;
}

export interface BooksRow {
  id: string;
  workOrderId: string;
  shopId?: string | null;
  kind: string;
  appliesTo: string;
  amountCents: number;
  status?: string | null;
  sourceId?: string | null;
  depositAt?: string | Date | null;
  createdAt?: string | Date | null;
  note?: string | null;
}

export interface MonthCloseIssue {
  id: string;
  reason: string;
}

export interface MonthClose {
  unmatchedDeposits: MonthCloseIssue[];
  openRefunds: MonthCloseIssue[];
  unpaid: MonthCloseIssue[];
  readyToSync: boolean;
  warnings: string[];
}

export interface FeeMovement {
  id: string;
  shopId: string;
  workOrderId: string;
  /** collected = card fee or legacy opening balance. settled = shop paid FixTray. accrued = in-person fee not yet paid. */
  kind: 'collected' | 'accrued' | 'settled' | 'refund' | 'chargeback';
  feeCents: number;
  at: string;
}

export interface PerShopFees {
  shopId: string;
  collectedCents: number;
  refundedCents: number;
  netCents: number;
}

export interface PlatformFeeYear {
  /** Card fees, legacy opening balances, and shop settlements. Not in-person cash before the shop pays. */
  collectedCents: number;
  /** In-person fees recorded at checkout. Not cash FixTray has received. */
  accruedCents: number;
  /** Shop settlements. Also included in collectedCents. */
  settledCents: number;
  /** accruedCents minus settledCents. Not clamped, so a later settlement can be negative. */
  owedCents: number;
  refundedCents: number;
  /** collectedCents minus fee refunds and chargebacks. */
  netCents: number;
  history: FeeMovement[];
  perShop: PerShopFees[];
}

export function usdToCents(usd: number | null | undefined): number {
  const amount = Number(usd);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function centsToUsd(cents: number): number {
  return Math.round(cents) / 100;
}

function cents(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer number of cents`);
  }
  return value;
}

function requireActor(actorId: string, at: string): void {
  if (!actorId.trim()) throw new Error('audit requires who');
  if (!at.trim() || Number.isNaN(new Date(at).getTime())) throw new Error('audit requires when');
}

export function auditEvent(input: {
  actorId: string;
  at: string;
  action: string;
  targetType: string;
  targetId: string;
  shopId?: string | null;
  details: string;
}): BooksAuditEvent {
  requireActor(input.actorId, input.at);
  return {
    actorId: input.actorId,
    at: input.at,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    shopId: input.shopId ?? null,
    details: input.details,
  };
}

export function standingFor(input: {
  jobCents: number;
  shopReceivedCents: number;
  hadJobReversal: boolean;
}): PaymentStanding {
  const job = input.jobCents;
  const received = input.shopReceivedCents;
  if (job > 0 && received === job) return 'paid';
  if (received <= 0) return input.hadJobReversal ? 'reversed' : 'unpaid';
  if (job > 0 && received < job) return 'partial';
  return 'paid';
}

export interface CardPlan {
  ok: true;
  entries: BooksEntryDraft[];
  customerPaidJobCents: number;
  shopReceivedCents: number;
  platformFeeCents: number;
  cardJobCents: number;
  standing: PaymentStanding;
  audit: BooksAuditEvent;
}

/**
 * A card charge is the shop job plus the live FixTray fee.
 * Shop received is the job, never the job minus the fee.
 * A charge below the job is a partial job payment and does not invent a fee.
 */
export function planCardPayment(input: {
  paymentIntentId: string;
  workOrderId: string;
  shopId?: string | null;
  jobCents: number;
  chargedCents: number;
  actorId: string;
  at: string;
}): CardPlan | { ok: false; error: string } {
  const job = cents(input.jobCents, 'job');
  const charged = cents(input.chargedCents, 'charge');
  if (!input.paymentIntentId.trim()) return { ok: false, error: 'A PaymentIntent id is required' };
  if (job <= 0) return { ok: false, error: 'The shop job amount is missing' };
  if (charged <= 0) return { ok: false, error: 'The card charge is empty' };

  const shopReceived = Math.min(charged, job);
  const platformFee = charged > job ? charged - job : 0;
  const entries: BooksEntryDraft[] = [
    {
      kind: 'card_payment',
      appliesTo: 'job',
      amountCents: shopReceived,
      status: 'posted',
      idempotencyKey: `${input.paymentIntentId}:card:job`,
      sourceId: input.paymentIntentId,
      depositAt: null,
      note: null,
    },
  ];
  if (platformFee > 0) {
    entries.push({
      kind: 'card_payment',
      appliesTo: 'fee',
      amountCents: platformFee,
      status: 'posted',
      idempotencyKey: `${input.paymentIntentId}:card:fee`,
      sourceId: input.paymentIntentId,
      depositAt: null,
      note: null,
    });
  }

  return {
    ok: true,
    entries,
    customerPaidJobCents: shopReceived,
    shopReceivedCents: shopReceived,
    platformFeeCents: platformFee,
    cardJobCents: shopReceived,
    standing: standingFor({ jobCents: job, shopReceivedCents: shopReceived, hadJobReversal: false }),
    audit: auditEvent({
      actorId: input.actorId,
      at: input.at,
      action: 'books.card_payment',
      targetType: 'work_order',
      targetId: input.workOrderId,
      shopId: input.shopId,
      details: `job ${shopReceived} cents; shop received ${shopReceived} cents; platform fee ${platformFee} cents`,
    }),
  };
}

/** Legacy paid jobs have no ledger rows yet. Write these before a reversal so the reversal has a source. */
export function openingBalanceEntries(job: {
  id: string;
  shopReceivedCents: number;
  platformFeeCents: number;
}): BooksEntryDraft[] {
  const entries: BooksEntryDraft[] = [];
  if (job.shopReceivedCents > 0) {
    entries.push({
      kind: 'job_payment',
      appliesTo: 'job',
      amountCents: job.shopReceivedCents,
      status: 'posted',
      idempotencyKey: `opening:${job.id}:job`,
      sourceId: null,
      depositAt: null,
      note: 'opening balance',
    });
  }
  if (job.platformFeeCents > 0) {
    entries.push({
      kind: 'job_payment',
      appliesTo: 'fee',
      amountCents: job.platformFeeCents,
      status: 'posted',
      idempotencyKey: `opening:${job.id}:fee`,
      sourceId: null,
      depositAt: null,
      note: 'opening balance',
    });
  }
  return entries;
}

export function planDeposit(input: {
  workOrderId: string;
  shopId?: string | null;
  amountCents: number;
  depositAt: string;
  actorId: string;
  at: string;
  /** Shop receipt already on the job. Required for a deposit that can close. */
  shopReceivedCents?: number;
}): { ok: true; entry: BooksEntryDraft; audit: BooksAuditEvent } | { ok: false; error: string } {
  const amount = cents(input.amountCents, 'deposit');
  if (amount <= 0) return { ok: false, error: 'Deposit amount must be greater than zero' };
  if (input.shopReceivedCents != null) {
    const received = cents(input.shopReceivedCents, 'shop receipt');
    if (received <= 0) {
      return { ok: false, error: 'Record the customer payment before depositing it' };
    }
    if (amount !== received) {
      return { ok: false, error: 'Deposit must match the shop receipt' };
    }
  }
  const when = new Date(input.depositAt);
  if (Number.isNaN(when.getTime())) return { ok: false, error: 'Deposit date is required' };
  const depositAt = when.toISOString();
  return {
    ok: true,
    entry: {
      kind: 'deposit',
      appliesTo: 'job',
      amountCents: amount,
      status: 'posted',
      idempotencyKey: `deposit:${input.workOrderId}:${depositAt}:${amount}`,
      sourceId: null,
      depositAt,
      note: null,
    },
    audit: auditEvent({
      actorId: input.actorId,
      at: input.at,
      action: 'books.deposit',
      targetType: 'work_order',
      targetId: input.workOrderId,
      shopId: input.shopId,
      details: `deposit ${amount} cents on ${depositAt}`,
    }),
  };
}

/**
 * A refund or chargeback hits one source.
 * A job source moves customer paid and shop received by the same cents.
 * A fee source moves only the platform fee.
 */
export function planSourceReversal(input: {
  kind: 'refund' | 'chargeback';
  appliesTo: 'job' | 'fee';
  amountCents: number;
  sourceRemainingCents: number;
  status: 'posted' | 'open';
  sourceId: string;
  workOrderId: string;
  shopId?: string | null;
  actorId: string;
  at: string;
}):
  | {
      ok: true;
      entry: BooksEntryDraft;
      shopDeltaCents: number;
      feeDeltaCents: number;
      audit: BooksAuditEvent;
    }
  | { ok: false; error: string } {
  const amount = cents(input.amountCents, 'reversal');
  const remaining = cents(input.sourceRemainingCents, 'source remaining');
  if (!input.sourceId.trim()) return { ok: false, error: 'A source id is required' };
  if (amount <= 0) return { ok: false, error: 'Reversal amount must be greater than zero' };
  if (amount > remaining) {
    return { ok: false, error: 'Reversal is larger than the source line' };
  }
  const posted = input.status === 'posted';
  const shopDelta = posted && input.appliesTo === 'job' ? -amount : 0;
  const feeDelta = posted && input.appliesTo === 'fee' ? -amount : 0;
  return {
    ok: true,
    entry: {
      kind: input.kind,
      appliesTo: input.appliesTo,
      amountCents: amount,
      status: input.status,
      idempotencyKey: `${input.sourceId}:${input.kind}:${input.appliesTo}:${input.status}`,
      sourceId: input.sourceId,
      depositAt: null,
      note: null,
    },
    shopDeltaCents: shopDelta,
    feeDeltaCents: feeDelta,
    audit: auditEvent({
      actorId: input.actorId,
      at: input.at,
      action: input.kind === 'chargeback' ? 'books.chargeback' : 'books.refund',
      targetType: 'work_order',
      targetId: input.workOrderId,
      shopId: input.shopId,
      details: `${input.status} ${input.kind} ${amount} cents on ${input.appliesTo}; shop delta ${shopDelta}; fee delta ${feeDelta}`,
    }),
  };
}

/**
 * Split one refund amount across the job and the fee.
 * auto applies the job source first, then the fee, and never takes the fee out of the shop twice.
 * job and fee name the source line directly.
 */
export function allocateRefund(
  amountCents: number,
  jobRemainingCents: number,
  feeRemainingCents: number,
  appliesTo: 'auto' | 'job' | 'fee' = 'auto',
): { jobCents: number; feeCents: number } | { error: string } {
  const amount = cents(amountCents, 'refund');
  const jobRemaining = cents(jobRemainingCents, 'job remaining');
  const feeRemaining = cents(feeRemainingCents, 'fee remaining');
  if (amount <= 0) return { error: 'Reversal amount must be greater than zero' };

  if (appliesTo === 'job') {
    if (amount > jobRemaining) return { error: 'Reversal is larger than the job source' };
    return { jobCents: amount, feeCents: 0 };
  }
  if (appliesTo === 'fee') {
    if (amount > feeRemaining) return { error: 'Reversal is larger than the fee source' };
    return { jobCents: 0, feeCents: amount };
  }
  if (amount > jobRemaining + feeRemaining) return { error: 'Reversal is larger than the source lines' };
  const jobPart = Math.min(amount, jobRemaining);
  return { jobCents: jobPart, feeCents: amount - jobPart };
}

export function planAllocatedReversal(input: {
  kind: 'refund' | 'chargeback';
  amountCents: number;
  jobRemainingCents: number;
  feeRemainingCents: number;
  appliesTo?: 'auto' | 'job' | 'fee';
  status: 'posted' | 'open';
  sourceId: string;
  workOrderId: string;
  shopId?: string | null;
  actorId: string;
  at: string;
}):
  | { ok: true; entries: BooksEntryDraft[]; shopDeltaCents: number; feeDeltaCents: number; audit: BooksAuditEvent }
  | { ok: false; error: string } {
  const split = allocateRefund(
    input.amountCents,
    input.jobRemainingCents,
    input.feeRemainingCents,
    input.appliesTo ?? 'auto',
  );
  if ('error' in split) return { ok: false, error: split.error };

  const entries: BooksEntryDraft[] = [];
  let shopDelta = 0;
  let feeDelta = 0;
  const pieces: Array<{ appliesTo: 'job' | 'fee'; amountCents: number }> = [];
  if (split.jobCents > 0) pieces.push({ appliesTo: 'job', amountCents: split.jobCents });
  if (split.feeCents > 0) pieces.push({ appliesTo: 'fee', amountCents: split.feeCents });
  for (const piece of pieces) {
    const planned = planSourceReversal({
      ...input,
      appliesTo: piece.appliesTo,
      amountCents: piece.amountCents,
      sourceRemainingCents: piece.appliesTo === 'job' ? input.jobRemainingCents : input.feeRemainingCents,
    });
    if (!planned.ok) return planned;
    entries.push(planned.entry);
    shopDelta += planned.shopDeltaCents;
    feeDelta += planned.feeDeltaCents;
  }
  return {
    ok: true,
    entries,
    shopDeltaCents: shopDelta,
    feeDeltaCents: feeDelta,
    audit: auditEvent({
      actorId: input.actorId,
      at: input.at,
      action: input.kind === 'chargeback' ? 'books.chargeback' : 'books.refund',
      targetType: 'work_order',
      targetId: input.workOrderId,
      shopId: input.shopId,
      details: `${input.status} ${input.kind} shop delta ${shopDelta} cents; fee delta ${feeDelta} cents`,
    }),
  };
}

function stamp(value: string | Date | null | undefined): number {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function iso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function legacyPosition(order: OrderInput, jobCents: number): { settled: number; fee: number } {
  const status = String(order.paymentStatus || '').trim().toLowerCase();
  const charged = usdToCents(order.amountPaid);
  if (jobCents <= 0 || charged <= 0 || status === 'unpaid' || status === 'refunded') {
    return { settled: 0, fee: 0 };
  }
  if (charged < jobCents) return { settled: charged, fee: 0 };
  return { settled: jobCents, fee: charged - jobCents };
}

export function assembleShopJobs(orders: OrderInput[], rows: BooksRow[]): ShopJob[] {
  return orders.map((order) => {
    const jobCents = usdToCents(order.estimatedCost);
    const mine = rows
      .filter((row) => row.workOrderId === order.id)
      .slice()
      .sort((a, b) => stamp(a.createdAt) - stamp(b.createdAt) || a.id.localeCompare(b.id));
    const money = mine.filter((row) => row.kind !== 'deposit');
    let settled = 0;
    let fee = 0;
    let hadJobReversal = false;
    const openIds: string[] = [];
    const postedKeys = new Set(
      money
        .filter((row) => String(row.status || 'posted') !== 'open' && (row.kind === 'refund' || row.kind === 'chargeback'))
        .map((row) => `${row.sourceId || ''}:${row.appliesTo}`),
    );

    if (money.length === 0) {
      const legacy = legacyPosition(order, jobCents);
      settled = legacy.settled;
      fee = legacy.fee;
    } else {
      for (const row of money) {
        const amount = cents(row.amountCents, 'books amount');
        const open = String(row.status || 'posted') === 'open';
        const reversal = row.kind === 'refund' || row.kind === 'chargeback';
        if (open && reversal) {
          const key = `${row.sourceId || ''}:${row.appliesTo}`;
          if (!postedKeys.has(key)) openIds.push(row.id);
          continue;
        }
        if (open) continue;
        if (row.kind === 'card_payment' || row.kind === 'job_payment') {
          if (row.appliesTo === 'fee') fee += amount;
          else settled += amount;
        } else if (reversal) {
          if (row.appliesTo === 'fee') fee = Math.max(0, fee - amount);
          else {
            settled = Math.max(0, settled - amount);
            hadJobReversal = true;
          }
        }
      }
    }

    const deposits = mine.filter((row) => row.kind === 'deposit' && String(row.status || 'posted') !== 'open');
    const deposit = deposits[deposits.length - 1];
    return {
      id: order.id,
      shopId: order.shopId,
      jobCents,
      customerPaidJobCents: settled,
      shopReceivedCents: settled,
      platformFeeCents: fee,
      cardJobCents: settled,
      depositCents: deposit ? deposit.amountCents : null,
      depositAt: deposit ? iso(deposit.depositAt) : null,
      openReversalIds: openIds,
      standing: standingFor({ jobCents, shopReceivedCents: settled, hadJobReversal }),
    };
  });
}

export function shopLedger(jobs: ShopJob[]): ShopLedger {
  const standing: StandingBuckets = {
    unpaid: { count: 0, remainingCents: 0 },
    partial: { count: 0, remainingCents: 0, paidCents: 0 },
    paid: { count: 0, paidCents: 0 },
    reversed: { count: 0, reversedCents: 0 },
  };
  let customerPaid = 0;
  let fee = 0;
  for (const job of jobs) {
    if (job.customerPaidJobCents !== job.shopReceivedCents) {
      throw new Error(`Job ${job.id} customer paid does not equal shop received`);
    }
    customerPaid += job.shopReceivedCents;
    fee += job.platformFeeCents;
    const remaining = Math.max(0, job.jobCents - job.shopReceivedCents);
    if (job.standing === 'unpaid') {
      standing.unpaid.count += 1;
      standing.unpaid.remainingCents += remaining;
    } else if (job.standing === 'partial') {
      standing.partial.count += 1;
      standing.partial.remainingCents += remaining;
      standing.partial.paidCents += job.shopReceivedCents;
    } else if (job.standing === 'paid') {
      standing.paid.count += 1;
      standing.paid.paidCents += job.shopReceivedCents;
    } else {
      standing.reversed.count += 1;
      standing.reversed.reversedCents += job.jobCents;
    }
  }
  return {
    jobs,
    customerPaidJobCents: customerPaid,
    shopReceivedCents: customerPaid,
    platformFeeCents: fee,
    shopTotalCents: customerPaid,
    feeDeductedFromShop: false,
    standing,
  };
}

export function shopReport(ledger: ShopLedger): ShopReport {
  return {
    customerPaidJobCents: ledger.customerPaidJobCents,
    shopReceivedCents: ledger.shopReceivedCents,
    shopTotalCents: ledger.shopReceivedCents,
    unpaidCents: ledger.standing.unpaid.remainingCents,
    partialCents: ledger.standing.partial.remainingCents,
    paidCents: ledger.standing.paid.paidCents,
    platformFeeCents: ledger.platformFeeCents,
    feeDeductedFromShop: false,
  };
}

export function reportsMatchLedger(ledger: ShopLedger, report: ShopReport): boolean {
  return report.customerPaidJobCents === ledger.customerPaidJobCents
    && report.shopReceivedCents === ledger.shopReceivedCents
    && report.customerPaidJobCents === report.shopReceivedCents
    && report.shopTotalCents === report.shopReceivedCents
    && report.feeDeductedFromShop === false
    && report.unpaidCents === ledger.standing.unpaid.remainingCents
    && report.partialCents === ledger.standing.partial.remainingCents
    && report.paidCents === ledger.standing.paid.paidCents
    && report.platformFeeCents === ledger.platformFeeCents;
}

export function depositLinesUp(job: ShopJob): { ok: true } | { ok: false; reason: string } {
  if (job.customerPaidJobCents !== job.shopReceivedCents || job.cardJobCents !== job.shopReceivedCents) {
    return { ok: false, reason: 'card_job_mismatch' };
  }
  if (job.shopReceivedCents <= 0) {
    if (job.depositCents != null && job.depositCents > 0) return { ok: false, reason: 'deposit_without_shop_receipt' };
    return { ok: true };
  }
  if (job.depositCents == null || !job.depositAt) return { ok: false, reason: 'missing_deposit' };
  if (job.depositCents !== job.shopReceivedCents) return { ok: false, reason: 'deposit_amount_mismatch' };
  return { ok: true };
}

export function monthClose(jobs: ShopJob[]): MonthClose {
  const unmatchedDeposits: MonthCloseIssue[] = [];
  const openRefunds: MonthCloseIssue[] = [];
  const unpaid: MonthCloseIssue[] = [];
  for (const job of jobs) {
    if (job.standing === 'unpaid' || job.standing === 'partial') {
      unpaid.push({ id: job.id, reason: job.standing });
    }
    for (const id of job.openReversalIds) openRefunds.push({ id, reason: 'open_refund' });
    const deposit = depositLinesUp(job);
    if (!deposit.ok) unmatchedDeposits.push({ id: job.id, reason: deposit.reason });
  }
  const warnings = [
    ...unmatchedDeposits.map((issue) => `Unmatched deposit on ${issue.id}: ${issue.reason}`),
    ...openRefunds.map((issue) => `Open refund ${issue.id}`),
    ...unpaid.map((issue) => `${issue.reason} job ${issue.id}`),
  ];
  return {
    unmatchedDeposits,
    openRefunds,
    unpaid,
    readyToSync: warnings.length === 0,
    warnings,
  };
}

export function inMonth(value: string | Date | null | undefined, month: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(month)) return false;
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return false;
  const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  return key === month;
}

function movementAt(value: string | Date | null | undefined): string {
  return iso(value) || new Date(0).toISOString();
}

/**
 * Cash FixTray has actually received is a card fee, a legacy opening balance,
 * or a shop settlement. An in-person fee is accrued until the shop pays it.
 */
export function classifyFeeRow(row: Pick<BooksRow, 'kind' | 'appliesTo' | 'status' | 'note'>): FeeMovement['kind'] | null {
  if (row.appliesTo !== 'fee') return null;
  if (String(row.status || 'posted') === 'open') return null;
  const opening = String(row.note || '').toLowerCase().includes('opening balance');
  if (row.kind === 'card_payment') return 'collected';
  if (row.kind === 'fee_settlement') return 'settled';
  if (row.kind === 'job_payment') return opening ? 'collected' : 'accrued';
  if (row.kind === 'refund') return 'refund';
  if (row.kind === 'chargeback') return 'chargeback';
  return null;
}

/** Live fee movements. Shop job cents are not copied onto these rows. */
export function feeMovements(orders: OrderInput[], rows: BooksRow[]): FeeMovement[] {
  const movements: FeeMovement[] = [];
  for (const order of orders) {
    const mine = rows.filter((row) => row.workOrderId === order.id && row.kind !== 'deposit');
    if (mine.length === 0) {
      const legacy = legacyPosition(order, usdToCents(order.estimatedCost));
      if (legacy.fee > 0) {
        movements.push({
          id: `${order.id}:legacy-fee`,
          shopId: order.shopId,
          workOrderId: order.id,
          kind: 'collected',
          feeCents: legacy.fee,
          at: movementAt(order.createdAt),
        });
      }
      continue;
    }
    for (const row of mine) {
      if (row.appliesTo !== 'fee') continue;
      if (String(row.status || 'posted') === 'open') continue;
      const kind = classifyFeeRow(row);
      if (!kind) continue;
      movements.push({
        id: row.id,
        shopId: order.shopId,
        workOrderId: order.id,
        kind,
        feeCents: row.amountCents,
        at: movementAt(row.createdAt || order.createdAt),
      });
    }
  }
  return movements;
}

function receivedFee(kind: FeeMovement['kind']): boolean {
  return kind === 'collected' || kind === 'settled';
}

export function platformFeeYear(movements: FeeMovement[]): PlatformFeeYear {
  let collected = 0;
  let accrued = 0;
  let settled = 0;
  let refunded = 0;
  const byShop = new Map<string, PerShopFees>();
  for (const movement of movements) {
    const row = byShop.get(movement.shopId) || {
      shopId: movement.shopId,
      collectedCents: 0,
      refundedCents: 0,
      netCents: 0,
    };
    if (receivedFee(movement.kind)) {
      collected += movement.feeCents;
      row.collectedCents += movement.feeCents;
      if (movement.kind === 'settled') settled += movement.feeCents;
    } else if (movement.kind === 'accrued') {
      accrued += movement.feeCents;
    } else {
      refunded += movement.feeCents;
      row.refundedCents += movement.feeCents;
    }
    row.netCents = row.collectedCents - row.refundedCents;
    byShop.set(movement.shopId, row);
  }
  const history = movements.slice().sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  return {
    collectedCents: collected,
    accruedCents: accrued,
    settledCents: settled,
    owedCents: accrued - settled,
    refundedCents: refunded,
    netCents: collected - refunded,
    history,
    perShop: [...byShop.values()].sort((a, b) => a.shopId.localeCompare(b.shopId)),
  };
}

/** Shop receipt. A card charge stores the customer fee on top of the job in amountPaid. */
export function shopJobReceiptCents(input: {
  amountPaid?: number | null;
  estimatedCost?: number | null;
  paymentStatus?: string | null;
}): number {
  const job = usdToCents(input.estimatedCost);
  const charged = usdToCents(input.amountPaid);
  const status = String(input.paymentStatus || '').trim().toLowerCase();
  if (charged <= 0 || status === 'unpaid' || status === 'refunded') return 0;
  if (job > 0 && charged > job) return job;
  return charged;
}

export function accountantFeeCsv(year: PlatformFeeYear): string {
  const lines = ['date,shop_id,kind,fee_cents'];
  for (const row of year.history) {
    lines.push(`${row.at},${row.shopId},${row.kind},${row.feeCents}`);
  }
  lines.push(`total,,collected,${year.collectedCents}`);
  lines.push(`total,,refunded,${year.refundedCents}`);
  lines.push(`total,,net,${year.netCents}`);
  return `${lines.join('\n')}\n`;
}

export type InPersonMethod = 'cash' | 'check' | 'other' | 'card';

/** Work-order paymentStatus the rest of the app already writes. Partial is pending. */
export function paymentStatusForStanding(standing: PaymentStanding): 'paid' | 'pending' | 'unpaid' | 'refunded' {
  if (standing === 'paid') return 'paid';
  if (standing === 'partial') return 'pending';
  if (standing === 'reversed') return 'refunded';
  return 'unpaid';
}

export interface InPersonPlan {
  ok: true;
  entries: BooksEntryDraft[];
  customerPaidJobCents: number;
  shopReceivedCents: number;
  platformFeeCents: number;
  standing: PaymentStanding;
  paymentStatus: 'paid' | 'pending' | 'unpaid';
  feeDeductedFromShop: false;
  audit: BooksAuditEvent;
}

/**
 * Counter payment. The shop keeps the full job cents collected.
 * The FixTray fee is written appliesTo=fee and is not subtracted from the shop.
 * Pass customerFacingFeeCents to record the fee frozen at checkout. When that
 * is omitted, the fee is the card gross-up of savedFeeCents (older callers).
 * A partial tender records no fee until the job is paid in full.
 */
export function planInPersonPayment(input: {
  workOrderId: string;
  shopId?: string | null;
  jobCents: number;
  alreadyReceivedCents: number;
  tenderedCents: number;
  savedFeeCents: number;
  /** Exact customer fee from the checkout snapshot. Not recomputed. */
  customerFacingFeeCents?: number | null;
  method: InPersonMethod;
  feeAlreadyRecorded: boolean;
  actorId: string;
  at: string;
}): InPersonPlan | { ok: false; error: string } {
  const job = cents(input.jobCents, 'job');
  const already = cents(input.alreadyReceivedCents, 'already received');
  const tendered = cents(input.tenderedCents, 'tender');
  const savedFee = cents(input.savedFeeCents, 'saved fee');
  if (job <= 0) return { ok: false, error: 'The shop job amount is missing' };
  if (already > job) return { ok: false, error: 'This job is already paid past the shop total' };
  if (tendered <= 0) return { ok: false, error: 'Enter the amount the customer paid' };
  const remaining = job - already;
  if (tendered > remaining) {
    return { ok: false, error: 'That amount is more than the shop still has coming' };
  }
  const shopReceived = already + tendered;
  const standing = standingFor({ jobCents: job, shopReceivedCents: shopReceived, hadJobReversal: false });
  const platformFee = standing === 'paid' && !input.feeAlreadyRecorded
    ? (input.customerFacingFeeCents == null
      ? customerFacingServiceFeeCents(job, savedFee)
      : cents(input.customerFacingFeeCents, 'customer fee'))
    : 0;
  const entries: BooksEntryDraft[] = [
    {
      kind: 'job_payment',
      appliesTo: 'job',
      amountCents: tendered,
      status: 'posted',
      idempotencyKey: `inperson:${input.workOrderId}:job:${shopReceived}`,
      sourceId: null,
      depositAt: null,
      note: `in-person ${input.method}`,
    },
  ];
  if (platformFee > 0) {
    entries.push({
      kind: 'job_payment',
      appliesTo: 'fee',
      amountCents: platformFee,
      status: 'posted',
      idempotencyKey: `inperson:${input.workOrderId}:fee`,
      sourceId: null,
      depositAt: null,
      note: `in-person ${input.method}; platform fee; not a shop expense`,
    });
  }
  return {
    ok: true,
    entries,
    customerPaidJobCents: shopReceived,
    shopReceivedCents: shopReceived,
    platformFeeCents: platformFee,
    standing,
    paymentStatus: (() => {
      const status = paymentStatusForStanding(standing);
      return status === 'refunded' ? 'unpaid' : status;
    })(),
    feeDeductedFromShop: false,
    audit: auditEvent({
      actorId: input.actorId,
      at: input.at,
      action: 'books.in_person_payment',
      targetType: 'work_order',
      targetId: input.workOrderId,
      shopId: input.shopId,
      details: `in-person ${input.method}; job ${tendered} cents; shop received ${shopReceived} cents; platform fee ${platformFee} cents; fee not deducted from shop`,
    }),
  };
}

export interface InPersonFeeLine {
  id: string;
  shopId: string;
  workOrderId: string;
  feeCents: number;
  at: string;
  note: string | null;
}

export interface InPersonFeeOwed {
  accruedCents: number;
  settledCents: number;
  owedCents: number;
  /** Gross in-person fee rows. Settlements are not netted here. */
  lines: InPersonFeeLine[];
  /** Per work order, fee cents still open after settlements in the same window. */
  openLines: InPersonFeeLine[];
  feeDeductedFromShop: false;
}

function inRange(value: string | Date | null | undefined, range?: { start: Date; end: Date }): boolean {
  if (!range) return true;
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return false;
  return date.getTime() >= range.start.getTime() && date.getTime() < range.end.getTime();
}

/**
 * FixTray amount the shop still owes from in-person fee rows.
 * Card fees are already collected on the Stripe charge and are not owed again.
 * Settlements reduce the open amount. Nothing here is a shop expense.
 */
export function inPersonFeeOwed(
  rows: BooksRow[],
  range?: { start: Date; end: Date },
): InPersonFeeOwed {
  const lines: InPersonFeeLine[] = [];
  const byOrder = new Map<string, InPersonFeeLine & { accrued: number; settled: number }>();
  let accrued = 0;
  let settled = 0;
  for (const row of rows) {
    if (row.appliesTo !== 'fee') continue;
    if (String(row.status || 'posted') === 'open') continue;
    if (!inRange(row.createdAt, range)) continue;
    const amount = cents(row.amountCents, 'fee');
    if (row.kind === 'job_payment') {
      accrued += amount;
      const line: InPersonFeeLine = {
        id: row.id,
        shopId: row.shopId || '',
        workOrderId: row.workOrderId,
        feeCents: amount,
        at: iso(row.createdAt) || '',
        note: null,
      };
      lines.push(line);
      const slot = byOrder.get(row.workOrderId) || { ...line, accrued: 0, settled: 0 };
      slot.accrued += amount;
      if (!slot.at) slot.at = line.at;
      byOrder.set(row.workOrderId, slot);
    } else if (row.kind === 'fee_settlement') {
      settled += amount;
      const slot = byOrder.get(row.workOrderId) || {
        id: row.id,
        shopId: row.shopId || '',
        workOrderId: row.workOrderId,
        feeCents: 0,
        at: iso(row.createdAt) || '',
        note: null,
        accrued: 0,
        settled: 0,
      };
      slot.settled += amount;
      byOrder.set(row.workOrderId, slot);
    }
  }
  const openLines = [...byOrder.values()]
    .map((slot) => ({
      id: slot.id,
      shopId: slot.shopId,
      workOrderId: slot.workOrderId,
      feeCents: Math.max(0, slot.accrued - slot.settled),
      at: slot.at,
      note: null,
    }))
    .filter((line) => line.feeCents > 0)
    .sort((a, b) => a.workOrderId.localeCompare(b.workOrderId) || a.id.localeCompare(b.id));
  return {
    accruedCents: accrued,
    settledCents: settled,
    owedCents: Math.max(0, accrued - settled),
    lines,
    openLines,
    feeDeductedFromShop: false,
  };
}

export interface InPersonOwedReportLine {
  shopId: string;
  workOrderId: string;
  feeCents: number;
  at: string;
}

/** Per-shop and per-work-order in-person fees still open. Card fees are excluded. */
export function inPersonOwedReport(
  orders: Array<{ id: string; shopId: string }>,
  rows: BooksRow[],
  range?: { start: Date; end: Date },
): {
  owedCents: number;
  lines: InPersonOwedReportLine[];
  byShop: Array<{ shopId: string; owedCents: number; lines: InPersonOwedReportLine[] }>;
} {
  const byShop = new Map<string, { owedCents: number; lines: InPersonOwedReportLine[] }>();
  const lines: InPersonOwedReportLine[] = [];
  for (const order of orders) {
    const owed = inPersonFeeOwed(rows.filter((row) => row.workOrderId === order.id), range);
    const shop = byShop.get(order.shopId) || { owedCents: 0, lines: [] };
    shop.owedCents += owed.owedCents;
    for (const line of owed.openLines) {
      const entry = {
        shopId: line.shopId || order.shopId,
        workOrderId: line.workOrderId,
        feeCents: line.feeCents,
        at: line.at,
      };
      shop.lines.push(entry);
      lines.push(entry);
    }
    byShop.set(order.shopId, shop);
  }
  return {
    owedCents: [...byShop.values()].reduce((sum, shop) => sum + shop.owedCents, 0),
    lines: lines.sort((a, b) => a.workOrderId.localeCompare(b.workOrderId) || a.shopId.localeCompare(b.shopId)),
    byShop: [...byShop.entries()]
      .map(([shopId, value]) => ({ shopId, owedCents: value.owedCents, lines: value.lines }))
      .sort((a, b) => a.shopId.localeCompare(b.shopId)),
  };
}

export function inPersonFeeInvoice(input: {
  shopName: string;
  weekLabel: string;
  owed: InPersonFeeOwed;
}): { subject: string; text: string } {
  const dollars = (input.owed.owedCents / 100).toFixed(2);
  const openLines = input.owed.openLines ?? input.owed.lines;
  const detail = openLines.length === 0
    ? 'No open in-person fee rows.'
    : openLines.map((line) => `${line.workOrderId}: $${(line.feeCents / 100).toFixed(2)}`).join('\n');
  return {
    subject: `FixTray fee invoice ${input.weekLabel}`,
    text: [
      `${input.shopName} owes FixTray $${dollars} for the week of ${input.weekLabel}.`,
      'These were in-person payments. The shop was paid the full job. This fee is owed to FixTray and is not a shop expense.',
      detail,
    ].join('\n'),
  };
}

/** Monday 00:00 UTC through the next Monday. Callers pass the instant they care about. */
export function utcWeekRange(at: Date): { start: Date; end: Date; label: string } {
  const day = at.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + mondayOffset));
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const label = start.toISOString().slice(0, 10);
  return { start, end, label };
}

export function planFeeSettlement(input: {
  workOrderId: string;
  shopId?: string | null;
  amountCents: number;
  paymentIntentId: string;
  actorId: string;
  at: string;
}): { ok: true; entry: BooksEntryDraft; audit: BooksAuditEvent } | { ok: false; error: string } {
  const amount = cents(input.amountCents, 'settlement');
  if (amount <= 0) return { ok: false, error: 'Settlement amount must be greater than zero' };
  if (!input.paymentIntentId.startsWith('pi_')) return { ok: false, error: 'A PaymentIntent id is required' };
  return {
    ok: true,
    entry: {
      kind: 'fee_settlement',
      appliesTo: 'fee',
      amountCents: amount,
      status: 'posted',
      idempotencyKey: `settle:${input.paymentIntentId}:${input.workOrderId}`,
      sourceId: input.paymentIntentId,
      depositAt: null,
      note: `shop paid FixTray fee ${input.paymentIntentId}`,
    },
    audit: auditEvent({
      actorId: input.actorId,
      at: input.at,
      action: 'books.fee_settlement',
      targetType: 'work_order',
      targetId: input.workOrderId,
      shopId: input.shopId,
      details: `fee settlement ${amount} cents via ${input.paymentIntentId}; not a shop expense`,
    }),
  };
}
