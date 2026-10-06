/**
 * QuickBooks Online payload for one shop month.
 * Built from the same shop figures as Books. The FixTray fee is omitted.
 * Re-sync skips entities whose idempotency key was already stored.
 */

import { isFeeAccountKey, SHOP_ACCOUNTS } from '@/lib/books/journal';
import { rangeSnapshot, type ShopJobFacts } from '@/lib/books/truth';

export interface QboAccountMap {
  sales: string;
  parts: string;
  tax: string;
  payments: string;
  refunds: string;
  labor: string;
  ar: string;
  inventory: string;
  ap: string;
  bank: string;
  customerCredits: string;
  cogs: string;
  undeposited: string;
}

export interface QboPushEntity {
  entity: 'Customer' | 'Vendor' | 'Item' | 'Invoice' | 'Payment' | 'Deposit' | 'CreditMemo' | 'Bill' | 'BillPayment' | 'InventoryAdjustment' | 'TimeActivity';
  idempotencyKey: string;
  workOrderId: string | null;
  billId: string | null;
  amountCents: number;
  body: Record<string, unknown>;
}

export interface QboMonthTotals {
  invoicedCents: number;
  paidCents: number;
  refundCents: number;
  taxCents: number;
  revenueCents: number;
}

export interface QboMismatch {
  workOrderId: string | null;
  billId: string | null;
  reason: string;
}

const FORBIDDEN = new Set(['fee', 'fixtrayfee', 'platformfee', 'feeexpense', 'fixtray']);

function cleanId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function fullQboMap(input: Record<string, unknown> | null | undefined):
  | { ok: true; map: QboAccountMap }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Account map is required' };
  }
  for (const key of Object.keys(input)) {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, '');
    if (FORBIDDEN.has(normalized) || isFeeAccountKey(key)) {
      return { ok: false, error: 'The FixTray fee is not a shop QuickBooks account' };
    }
  }
  const read = (key: keyof QboAccountMap, fallback: string) => {
    const value = input[key];
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  };
  const map: QboAccountMap = {
    sales: read('sales', SHOP_ACCOUNTS.laborIncome.name),
    parts: read('parts', SHOP_ACCOUNTS.partsIncome.name),
    tax: read('tax', SHOP_ACCOUNTS.salesTaxPayable.name),
    payments: read('payments', SHOP_ACCOUNTS.undepositedFunds.name),
    refunds: read('refunds', SHOP_ACCOUNTS.refunds.name),
    labor: read('labor', SHOP_ACCOUNTS.payrollExpense.name),
    ar: read('ar', SHOP_ACCOUNTS.accountsReceivable.name),
    inventory: read('inventory', SHOP_ACCOUNTS.inventory.name),
    ap: read('ap', SHOP_ACCOUNTS.accountsPayable.name),
    bank: read('bank', SHOP_ACCOUNTS.operatingBank.name),
    customerCredits: read('customerCredits', SHOP_ACCOUNTS.customerCredits.name),
    cogs: read('cogs', SHOP_ACCOUNTS.cogsParts.name),
    undeposited: read('undeposited', SHOP_ACCOUNTS.undepositedFunds.name),
  };
  for (const value of Object.values(map)) {
    if (FORBIDDEN.has(value.toLowerCase().replace(/[^a-z]/g, ''))) {
      return { ok: false, error: 'The FixTray fee is not a shop QuickBooks account' };
    }
  }
  return { ok: true, map };
}

export interface QboCustomer {
  id: string;
  name: string;
}

export interface QboVendor {
  id: string;
  name: string;
}

export interface QboItem {
  id: string;
  name: string;
  kind: 'labor' | 'part';
}

export interface QboBill {
  id: string;
  vendorId: string;
  date: string;
  dueDate: string;
  amountCents: number;
  itemId: string | null;
}

export interface QboBillPay {
  id: string;
  billId: string;
  date: string;
  amountCents: number;
}

export interface QboTime {
  id: string;
  personName: string;
  date: string;
  minutes: number;
  hourlyRateCents: number;
}

export interface QboDepositGroup {
  id: string;
  date: string;
  amountCents: number;
  workOrderIds: string[];
}

export interface QboAdjustment {
  id: string;
  itemId: string;
  date: string;
  amountCents: number;
}

function dollars(cents: number): number {
  return Math.round(cents) / 100;
}

function ref(value: string): { value: string } {
  return { value };
}

export function reconcileShopMonth(input: {
  jobs: ShopJobFacts[];
  start: Date;
  end: Date;
  bills?: QboBill[];
}): QboMismatch[] {
  const mismatches: QboMismatch[] = [];
  for (const job of input.jobs) {
    const payments = job.events.filter((event) => event.kind === 'payment' && new Date(event.at) >= input.start && new Date(event.at) < input.end);
    const invoiced = job.invoiceCents != null;
    if (payments.length > 0 && !invoiced) {
      mismatches.push({
        workOrderId: job.id,
        billId: null,
        reason: 'Payment is not tied to an invoice',
      });
    }
    if (job.invoiceCents != null && job.invoiceCents < 0) {
      mismatches.push({ workOrderId: job.id, billId: null, reason: 'Invoice amount is negative' });
    }
  }
  for (const bill of input.bills || []) {
    if (!bill.vendorId.trim()) {
      mismatches.push({ workOrderId: null, billId: bill.id, reason: 'Vendor bill has no vendor' });
    }
    if (bill.amountCents <= 0) {
      mismatches.push({ workOrderId: null, billId: bill.id, reason: 'Vendor bill amount is empty' });
    }
  }
  return mismatches;
}

export function buildQboBooksPush(input: {
  shopId: string;
  month: string;
  jobs: ShopJobFacts[];
  start: Date;
  end: Date;
  customers: QboCustomer[];
  vendors?: QboVendor[];
  items?: QboItem[];
  bills?: QboBill[];
  billPayments?: QboBillPay[];
  deposits?: QboDepositGroup[];
  adjustments?: QboAdjustment[];
  time?: QboTime[];
  map: Record<string, unknown> | null;
  alreadyPosted?: Record<string, string>;
  locked?: boolean;
}):
  | {
    ok: true;
    requests: QboPushEntity[];
    totals: QboMonthTotals;
    books: QboMonthTotals;
    feeIncluded: false;
    mismatches: QboMismatch[];
  }
  | { ok: false; error: string; mismatches: QboMismatch[] } {
  if (input.locked) {
    return { ok: false, error: `Month ${input.month} is locked after a clean sync`, mismatches: [] };
  }
  const mapped = fullQboMap(input.map);
  if (!mapped.ok) return { ok: false, error: mapped.error, mismatches: [] };
  const map = mapped.map;
  const mismatches = reconcileShopMonth(input);
  const booksSnapshot = rangeSnapshot(input.jobs, input.start, input.end);
  const books: QboMonthTotals = {
    invoicedCents: booksSnapshot.invoicedCents,
    paidCents: booksSnapshot.paidCents,
    refundCents: booksSnapshot.refundCents + booksSnapshot.chargebackCents,
    taxCents: 0,
    revenueCents: booksSnapshot.revenueCents,
  };
  const posted = input.alreadyPosted || {};
  const intended: QboPushEntity[] = [];
  const requests: QboPushEntity[] = [];
  const push = (entity: QboPushEntity) => {
    const blob = JSON.stringify(entity.body).toLowerCase();
    if (blob.includes('fixtray fee') || blob.includes('platform fee')) {
      throw new Error('FixTray fee leaked into a shop QuickBooks payload');
    }
    intended.push(entity);
    if (posted[entity.idempotencyKey]) return;
    requests.push(entity);
  };

  for (const customer of input.customers) {
    push({
      entity: 'Customer',
      idempotencyKey: `ft:${input.shopId}:customer:${customer.id}`,
      workOrderId: null,
      billId: null,
      amountCents: 0,
      body: { DisplayName: customer.name, Notes: `FixTray customer ${customer.id}` },
    });
  }
  for (const vendor of input.vendors || []) {
    push({
      entity: 'Vendor',
      idempotencyKey: `ft:${input.shopId}:vendor:${vendor.id}`,
      workOrderId: null,
      billId: null,
      amountCents: 0,
      body: { DisplayName: vendor.name },
    });
  }
  for (const item of input.items || []) {
    push({
      entity: 'Item',
      idempotencyKey: `ft:${input.shopId}:item:${item.id}`,
      workOrderId: null,
      billId: null,
      amountCents: 0,
      body: {
        Name: item.name,
        Type: item.kind === 'part' ? 'Inventory' : 'Service',
        IncomeAccountRef: ref(item.kind === 'part' ? map.parts : map.sales),
      },
    });
  }

  let taxCents = 0;
  for (const job of input.jobs) {
    const invoice = job.events.find((event) => event.kind === 'invoice' && new Date(event.at) >= input.start && new Date(event.at) < input.end);
    if (invoice && invoice.cents > 0) {
      const taxLine = Math.max(0, Math.round(invoice.taxCents || 0));
      taxCents += taxLine;
      const shopAmount = invoice.cents;
      const lines = [
        {
          Description: 'Shop labor and parts',
          Amount: dollars(Math.max(0, shopAmount - taxLine)),
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: { ItemRef: ref(map.sales) },
        },
      ];
      if (taxLine > 0) {
        lines.push({
          Description: 'Sales tax',
          Amount: dollars(taxLine),
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: { ItemRef: ref(map.tax) },
        });
      }
      push({
        entity: 'Invoice',
        idempotencyKey: `ft:${input.shopId}:${input.month}:invoice:${job.id}`,
        workOrderId: job.id,
        billId: null,
        amountCents: shopAmount,
        body: {
          DocNumber: `FT-INV-${job.id.slice(0, 12)}`,
          TxnDate: invoice.at.slice(0, 10),
          CustomerRef: ref(cleanId(job.customerId) || job.id),
          Line: lines,
          PrivateNote: `work order ${job.id}`,
        },
      });
    }
    for (const event of job.events) {
      if (new Date(event.at) < input.start || new Date(event.at) >= input.end) continue;
      if (event.kind === 'payment' && event.cents > 0) {
        push({
          entity: 'Payment',
          idempotencyKey: `ft:${input.shopId}:${input.month}:payment:${event.id}`,
          workOrderId: job.id,
          billId: null,
          amountCents: event.cents,
          body: {
            TotalAmt: dollars(event.cents),
            TxnDate: event.at.slice(0, 10),
            DepositToAccountRef: ref(map.undeposited),
            Line: [{ Amount: dollars(event.cents), LinkedTxn: [{ TxnId: `FT-INV-${job.id.slice(0, 12)}`, TxnType: 'Invoice' }] }],
            PrivateNote: `work order ${job.id}`,
          },
        });
      }
      if ((event.kind === 'refund' || event.kind === 'chargeback') && event.cents > 0) {
        push({
          entity: 'CreditMemo',
          idempotencyKey: `ft:${input.shopId}:${input.month}:refund:${event.id}`,
          workOrderId: job.id,
          billId: null,
          amountCents: event.cents,
          body: {
            TxnDate: event.at.slice(0, 10),
            Line: [{ Description: 'Shop job refund', Amount: dollars(event.cents), DetailType: 'SalesItemLineDetail' }],
            PrivateNote: `work order ${job.id}`,
          },
        });
      }
    }
  }

  for (const deposit of input.deposits || []) {
    push({
      entity: 'Deposit',
      idempotencyKey: `ft:${input.shopId}:${input.month}:deposit:${deposit.id}`,
      workOrderId: deposit.workOrderIds[0] || null,
      billId: null,
      amountCents: deposit.amountCents,
      body: {
        TxnDate: deposit.date.slice(0, 10),
        DepositToAccountRef: ref(map.bank),
        TotalAmt: dollars(deposit.amountCents),
        PrivateNote: deposit.workOrderIds.join(','),
      },
    });
  }
  for (const bill of input.bills || []) {
    push({
      entity: 'Bill',
      idempotencyKey: `ft:${input.shopId}:${input.month}:bill:${bill.id}`,
      workOrderId: null,
      billId: bill.id,
      amountCents: bill.amountCents,
      body: {
        TxnDate: bill.date.slice(0, 10),
        DueDate: bill.dueDate.slice(0, 10),
        VendorRef: ref(bill.vendorId),
        Line: [{ Amount: dollars(bill.amountCents), DetailType: 'AccountBasedExpenseLineDetail', AccountBasedExpenseLineDetail: { AccountRef: ref(map.inventory) } }],
      },
    });
  }
  for (const payment of input.billPayments || []) {
    push({
      entity: 'BillPayment',
      idempotencyKey: `ft:${input.shopId}:${input.month}:billpay:${payment.id}`,
      workOrderId: null,
      billId: payment.billId,
      amountCents: payment.amountCents,
      body: {
        TxnDate: payment.date.slice(0, 10),
        TotalAmt: dollars(payment.amountCents),
        PayType: 'Check',
        Line: [{ Amount: dollars(payment.amountCents), LinkedTxn: [{ TxnId: payment.billId, TxnType: 'Bill' }] }],
      },
    });
  }
  for (const adjustment of input.adjustments || []) {
    push({
      entity: 'InventoryAdjustment',
      idempotencyKey: `ft:${input.shopId}:${input.month}:adjust:${adjustment.id}`,
      workOrderId: null,
      billId: null,
      amountCents: adjustment.amountCents,
      body: {
        TxnDate: adjustment.date.slice(0, 10),
        PrivateNote: adjustment.itemId,
        Line: [{ Amount: dollars(adjustment.amountCents) }],
      },
    });
  }
  for (const row of input.time || []) {
    if (row.minutes <= 0 || row.hourlyRateCents <= 0) continue;
    push({
      entity: 'TimeActivity',
      idempotencyKey: `ft:${input.shopId}:${input.month}:time:${row.id}`,
      workOrderId: null,
      billId: null,
      amountCents: Math.round((row.minutes * row.hourlyRateCents) / 60),
      body: {
        TxnDate: row.date.slice(0, 10),
        NameOf: 'Employee',
        EmployeeRef: { name: row.personName },
        Hours: Math.floor(row.minutes / 60),
        Minutes: row.minutes % 60,
        HourlyRate: dollars(row.hourlyRateCents),
        BillableStatus: 'NotBillable',
        Description: 'Shop timesheet. FixTray does not run payroll.',
      },
    });
  }

  const totals: QboMonthTotals = {
    invoicedCents: intended.filter((row) => row.entity === 'Invoice').reduce((sum, row) => sum + row.amountCents, 0),
    paidCents: intended.filter((row) => row.entity === 'Payment').reduce((sum, row) => sum + row.amountCents, 0),
    refundCents: intended.filter((row) => row.entity === 'CreditMemo').reduce((sum, row) => sum + row.amountCents, 0),
    taxCents,
    revenueCents: 0,
  };
  totals.revenueCents = totals.paidCents - totals.refundCents;
  books.taxCents = taxCents;
  return { ok: true, requests, totals, books, feeIncluded: false, mismatches };
}

export function qboTotalsMatchBooks(totals: QboMonthTotals, books: QboMonthTotals): boolean {
  return totals.invoicedCents === books.invoicedCents
    && totals.paidCents === books.paidCents
    && totals.refundCents === books.refundCents
    && totals.revenueCents === books.revenueCents
    && totals.taxCents === books.taxCents;
}

const ENTITY_PATH: Record<QboPushEntity['entity'], string> = {
  Customer: 'customer',
  Vendor: 'vendor',
  Item: 'item',
  Invoice: 'invoice',
  Payment: 'payment',
  Deposit: 'deposit',
  CreditMemo: 'creditmemo',
  Bill: 'bill',
  BillPayment: 'billpayment',
  InventoryAdjustment: 'inventoryadjustment',
  TimeActivity: 'timeactivity',
};

function createdId(payload: unknown, entity: string): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const row = (payload as Record<string, { Id?: unknown }>)[entity];
  return row && typeof row.Id === 'string' && row.Id ? row.Id : null;
}

/** Post one QBO entity per request. Keys already stored are not sent again. */
export async function postQboEntities(input: {
  apiHost: string;
  realmId: string;
  accessToken: string;
  requests: QboPushEntity[];
  alreadyPosted?: Record<string, string>;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; posted: Record<string, string> } | { ok: false; error: string; posted: Record<string, string> }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const posted: Record<string, string> = { ...(input.alreadyPosted || {}) };
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${input.accessToken}`,
  };
  for (const request of input.requests) {
    if (posted[request.idempotencyKey]) continue;
    const path = ENTITY_PATH[request.entity];
    const url = `${input.apiHost.replace(/\/$/, '')}/v3/company/${encodeURIComponent(input.realmId)}/${path}?minorversion=75`;
    let response: Response;
    try {
      response = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(request.body) });
    } catch {
      return { ok: false, error: 'QuickBooks sync failed', posted };
    }
    const payload = await response.json().catch(() => null);
    const id = createdId(payload, request.entity);
    if (!response.ok || !id) {
      return { ok: false, error: 'QuickBooks sync failed', posted };
    }
    posted[request.idempotencyKey] = id;
  }
  return { ok: true, posted };
}
