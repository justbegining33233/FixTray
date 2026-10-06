/**
 * Shop statements for a date range. Built from the same job facts as Books.
 * Sales tax is its own payable. The FixTray fee is not a line.
 */

import { booksDayKey } from '@/lib/books/periods';
import { civilInRange, positionJobs, rangeSnapshot, type ShopJobFacts } from '@/lib/books/truth';
import { invoiceBases } from '@/lib/books/shopTax';
import {
  balanceSheetView,
  postBankDeposit,
  postBillPayment,
  postCollectedTax,
  postFeeHeld,
  postInventoryShrink,
  postInvoice,
  postOpeningInventory,
  postPartsCogs,
  postPayment,
  postPayrollAccrual,
  postRefund,
  postVendorBill,
  statementTotals,
  trialBalance,
  type JournalDraft,
} from '@/lib/books/journal';
import type { ShopTaxSettings } from '@/lib/books/shopTax';

function eventDay(at: string, timeZone: string): string {
  return booksDayKey(new Date(at), timeZone);
}

/**
 * Invoices and payments for the window. Tax is not added to AR.
 * A payment is applied to the job invoice even when that invoice is outside
 * the window, so it does not become customer credit. A job with no invoice
 * is skipped: those payments are not credit.
 */
export function journalForFacts(
  facts: ShopJobFacts[],
  start: Date,
  end: Date,
  _settings: Partial<ShopTaxSettings> | null | undefined,
  timeZone: string,
): JournalDraft[] {
  const entries: JournalDraft[] = [];
  for (const job of facts) {
    const invoiced = job.invoiceCents == null ? 0 : Math.max(0, Math.round(job.invoiceCents));
    if (invoiced <= 0) continue;
    const invoiceAt = job.invoiceAt || job.events.find((event) => event.kind === 'invoice')?.at;
    if (!invoiceAt) continue;
    const bases = invoiceBases({ invoiceCents: invoiced, partsSellCents: job.partsSellCents });
    if (civilInRange(invoiceAt, start, end, timeZone)) {
      entries.push(postInvoice({
        workOrderId: job.id,
        date: eventDay(invoiceAt, timeZone),
        laborCents: bases.laborCents,
        partsCents: bases.partsCents,
        taxCents: 0,
      }));
    }
    let open = invoiced;
    const payments = job.events
      .filter((event) => event.kind === 'payment' && event.cents > 0)
      .slice()
      .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    for (const event of payments) {
      if (!civilInRange(event.at, start, end, timeZone)) {
        if (eventDay(event.at, timeZone) < booksDayKey(start, timeZone)) {
          open = Math.max(0, open - event.cents);
        }
        continue;
      }
      entries.push(postPayment({
        id: event.id,
        workOrderId: job.id,
        date: eventDay(event.at, timeZone),
        amountCents: event.cents,
        openArCents: open,
        hasInvoice: true,
      }));
      open = Math.max(0, open - event.cents);
    }
    for (const event of job.events) {
      if (!civilInRange(event.at, start, end, timeZone)) continue;
      if ((event.kind === 'refund' || event.kind === 'chargeback') && event.cents > 0) {
        entries.push(postRefund({
          id: event.id,
          workOrderId: job.id,
          date: eventDay(event.at, timeZone),
          amountCents: event.cents,
        }));
      }
    }
  }
  return entries;
}

export interface DatedCents {
  id: string;
  at: string;
  cents: number;
}

export interface ShopStatementInput {
  jobs: ShopJobFacts[];
  timeZone: string;
  from: Date;
  to: Date;
  partsCost?: Array<DatedCents & { workOrderId: string }>;
  payroll?: Array<DatedCents & { personId: string }>;
  bills?: Array<DatedCents & { toInventory: boolean }>;
  billPayments?: DatedCents[];
  bankDeposits?: DatedCents[];
  collectedTax?: Array<DatedCents & { workOrderId: string }>;
  /** Counted write-offs. Each one is quantity times that item's own unit cost. */
  writeOffs?: DatedCents[];
  /** FixTray fee cash the shop is actually holding. Not a fee that was only booked. */
  feeHeld?: Array<DatedCents & { workOrderId: string }>;
  /** On-hand quantity times each item's own unit cost, from every inventory table. */
  inventoryValueCents: number;
}

function inWindow(at: string, start: Date, end: Date, timeZone: string): boolean {
  return civilInRange(at, start, end, timeZone);
}

/** Counter receipt rows track the drawer. They are not a bank deposit. */
export function isCounterReceiptNote(note: string | null | undefined): boolean {
  const text = String(note || '').toLowerCase();
  return text.includes('shop receipt') || text.includes('in-person');
}

/**
 * Cash already moved to the bank. Counter receipts stay in the drawer.
 * A running-total deposit row is kept as the last amount, not added to the earlier ones.
 * Nothing is banked beyond what the customer paid on that job.
 */
export function bankDepositEvents(jobs: ShopJobFacts[]): Array<DatedCents & { workOrderId: string }> {
  const rows: Array<DatedCents & { workOrderId: string }> = [];
  for (const job of jobs) {
    let paid = 0;
    for (const event of job.events) {
      if (event.kind === 'payment') paid += Math.max(0, Math.round(event.cents));
      else if (event.kind === 'refund' || event.kind === 'chargeback') paid -= Math.max(0, Math.round(event.cents));
    }
    const roomStart = Math.max(0, paid);
    const deposits = job.events
      .filter((event) => event.kind === 'deposit' && event.cents > 0 && !isCounterReceiptNote(event.note))
      .slice()
      .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    if (deposits.length === 0 || roomStart === 0) continue;
    const summed = deposits.reduce((sum, event) => sum + Math.round(event.cents), 0);
    const last = deposits[deposits.length - 1];
    if (Math.round(last.cents) === roomStart && summed !== roomStart) {
      rows.push({ id: last.id, at: last.at, cents: roomStart, workOrderId: job.id });
      continue;
    }
    let room = roomStart;
    for (const event of deposits) {
      const cents = Math.min(room, Math.round(event.cents));
      if (cents <= 0) break;
      rows.push({ id: event.id, at: event.at, cents, workOrderId: job.id });
      room -= cents;
    }
  }
  return rows;
}

/** Cash already moved to the bank. The bank_deposits table wins when it has a total. */
export function bankedReceiptCents(jobs: ShopJobFacts[], tableCents: number): number {
  const fromTable = Math.max(0, Math.round(tableCents || 0));
  if (fromTable > 0) return fromTable;
  return bankDepositEvents(jobs).reduce((sum, row) => sum + row.cents, 0);
}

/**
 * Balance sheet and profit and loss from the same journal.
 * Inventory is opening balance equity once, plus bills, minus cost of parts.
 * The ending inventory equals on-hand quantity times each item's own unit cost.
 * Net income is retained earnings.
 */
export function buildShopStatement(input: ShopStatementInput) {
  const wideStart = new Date('2000-01-01T00:00:00.000Z');
  const entries = journalForFacts(input.jobs, wideStart, input.to, null, input.timeZone);
  const zone = input.timeZone;
  for (const row of input.partsCost || []) {
    if (row.cents <= 0 || !inWindow(row.at, wideStart, input.to, zone)) continue;
    entries.push(postPartsCogs({
      id: row.id,
      workOrderId: row.workOrderId,
      date: eventDay(row.at, zone),
      amountCents: row.cents,
    }));
  }
  for (const row of input.payroll || []) {
    if (row.cents <= 0 || !inWindow(row.at, wideStart, input.to, zone)) continue;
    entries.push(postPayrollAccrual({
      id: row.id,
      personId: row.personId,
      date: eventDay(row.at, zone),
      amountCents: row.cents,
    }));
  }
  let inventoryBills = 0;
  for (const row of input.bills || []) {
    if (row.cents <= 0 || !inWindow(row.at, wideStart, input.to, zone)) continue;
    entries.push(postVendorBill({
      id: row.id,
      date: eventDay(row.at, zone),
      amountCents: row.cents,
      toInventory: row.toInventory,
    }));
    if (row.toInventory) inventoryBills += row.cents;
  }
  for (const row of input.billPayments || []) {
    if (row.cents <= 0 || !inWindow(row.at, wideStart, input.to, zone)) continue;
    entries.push(postBillPayment({ id: row.id, date: eventDay(row.at, zone), amountCents: row.cents }));
  }
  for (const row of input.bankDeposits || []) {
    if (row.cents <= 0 || !inWindow(row.at, wideStart, input.to, zone)) continue;
    entries.push(postBankDeposit({ id: row.id, date: eventDay(row.at, zone), amountCents: row.cents }));
  }
  for (const row of input.collectedTax || []) {
    if (row.cents <= 0 || !inWindow(row.at, wideStart, input.to, zone)) continue;
    entries.push(postCollectedTax({
      id: row.id,
      workOrderId: row.workOrderId,
      date: eventDay(row.at, zone),
      amountCents: row.cents,
    }));
  }
  let writeOffs = 0;
  for (const row of input.writeOffs || []) {
    if (row.cents <= 0 || !inWindow(row.at, wideStart, input.to, zone)) continue;
    entries.push(postInventoryShrink({ id: row.id, date: eventDay(row.at, zone), amountCents: row.cents }));
    writeOffs += row.cents;
  }
  for (const row of input.feeHeld || []) {
    if (row.cents <= 0 || !inWindow(row.at, wideStart, input.to, zone)) continue;
    entries.push(postFeeHeld({
      id: row.id,
      workOrderId: row.workOrderId,
      date: eventDay(row.at, zone),
      amountCents: row.cents,
    }));
  }

  const cogs = (input.partsCost || [])
    .filter((row) => row.cents > 0 && inWindow(row.at, wideStart, input.to, zone))
    .reduce((sum, row) => sum + row.cents, 0);
  const inventoryValue = Math.max(0, Math.round(input.inventoryValueCents));
  // Opening is only the stock already on hand before the bills in this statement.
  // Ending inventory is on-hand quantity times each item's own unit cost, so a
  // sale, return, bill, or write-off moves it. Write-offs stay an expense.
  const opening = inventoryValue - inventoryBills + cogs + writeOffs;
  if (opening !== 0) {
    entries.push(postOpeningInventory({
      id: 'opening-inventory',
      date: '2000-01-01',
      amountCents: opening,
    }));
  }

  const positions = positionJobs(input.jobs);
  const books = rangeSnapshot(input.jobs, input.from, input.to, input.timeZone);
  const asOf = statementTotals(entries);
  const sheet = balanceSheetView(entries);
  const periodEntries = entries.filter((entry) => {
    const day = entry.date;
    const startDay = booksDayKey(input.from, input.timeZone);
    const endDay = booksDayKey(input.to, input.timeZone);
    return day >= startDay && day < endDay;
  });
  return {
    entries,
    asOf,
    period: statementTotals(periodEntries),
    sheet,
    trial: trialBalance(entries),
    arCents: positions.reduce((sum, job) => sum + job.arCents, 0),
    customerCreditCents: positions.reduce((sum, job) => sum + job.customerCreditCents, 0),
    cashRevenueCents: books.revenueCents,
    books,
  };
}

export function periodCogsCents(rows: DatedCents[] | undefined, from: Date, to: Date, timeZone: string): number {
  return (rows || []).reduce((sum, row) => (inWindow(row.at, from, to, timeZone) ? sum + Math.max(0, row.cents) : sum), 0);
}

export const CASH_BASIS_NOTE = 'Cash basis. Shop money collected in these dates. The FixTray fee is not included.';

/** Profit and loss that matches Books revenue for the same dates. */
export function cashBasisIncome(input: {
  revenueCents: number;
  cogsCents: number;
  payrollCents: number;
  shopSuppliesCents: number;
}): {
  basis: 'cash';
  revenueCents: number;
  cogsCents: number;
  payrollCents: number;
  shopSuppliesCents: number;
  netIncomeCents: number;
  note: string;
} {
  const revenueCents = Math.round(input.revenueCents);
  const cogsCents = Math.max(0, Math.round(input.cogsCents));
  const payrollCents = Math.max(0, Math.round(input.payrollCents));
  const shopSuppliesCents = Math.max(0, Math.round(input.shopSuppliesCents));
  return {
    basis: 'cash',
    revenueCents,
    cogsCents,
    payrollCents,
    shopSuppliesCents,
    netIncomeCents: revenueCents - cogsCents - payrollCents - shopSuppliesCents,
    note: CASH_BASIS_NOTE,
  };
}
