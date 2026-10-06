/**
 * Shop double-entry journal. Every entry balances.
 * The FixTray fee is not an account and is not a line.
 */

export const SHOP_ACCOUNTS = {
  operatingBank: { code: '1000', name: 'Operating Bank', accountType: 'asset' },
  undepositedFunds: { code: '1100', name: 'Undeposited Funds', accountType: 'asset' },
  accountsReceivable: { code: '1200', name: 'Accounts Receivable', accountType: 'asset' },
  inventory: { code: '1300', name: 'Inventory Asset', accountType: 'asset' },
  accountsPayable: { code: '2000', name: 'Accounts Payable', accountType: 'liability' },
  salesTaxPayable: { code: '2100', name: 'Sales Tax Payable', accountType: 'liability' },
  customerCredits: { code: '2200', name: 'Customer Credits', accountType: 'liability' },
  wagesPayable: { code: '2300', name: 'Wages Payable', accountType: 'liability' },
  ownerEquity: { code: '3000', name: "Owner's Equity", accountType: 'equity' },
  laborIncome: { code: '4000', name: 'Labor Income', accountType: 'income' },
  partsIncome: { code: '4100', name: 'Parts Income', accountType: 'income' },
  subletIncome: { code: '4200', name: 'Sublet Income', accountType: 'income' },
  refunds: { code: '4900', name: 'Refunds', accountType: 'income' },
  cogsParts: { code: '5000', name: 'COGS Parts', accountType: 'cogs' },
  payrollExpense: { code: '6000', name: 'Payroll Labor Expense', accountType: 'expense' },
  shopSupplies: { code: '6100', name: 'Shop Supplies', accountType: 'expense' },
} as const;

export type ShopAccountKey = keyof typeof SHOP_ACCOUNTS;

export const DEFAULT_SHOP_ACCOUNTS = (Object.keys(SHOP_ACCOUNTS) as ShopAccountKey[]).map((systemKey) => ({
  systemKey,
  ...SHOP_ACCOUNTS[systemKey],
}));

const FEE_KEYS = new Set(['fee', 'fixtrayfee', 'platformfee', 'feeexpense']);

export function isFeeAccountKey(value: string): boolean {
  return FEE_KEYS.has(value.toLowerCase().replace(/[^a-z]/g, ''));
}

export interface JournalLineDraft {
  accountKey: ShopAccountKey;
  debitCents: number;
  creditCents: number;
  workOrderId?: string | null;
  memo?: string | null;
}

export interface JournalDraft {
  sourceType: string;
  sourceId: string;
  date: string;
  memo: string;
  lines: JournalLineDraft[];
}

function line(accountKey: ShopAccountKey, debitCents: number, creditCents: number, workOrderId?: string | null): JournalLineDraft {
  return { accountKey, debitCents, creditCents, workOrderId: workOrderId ?? null };
}

export function entryTotals(entry: JournalDraft): { debitCents: number; creditCents: number } {
  return entry.lines.reduce(
    (sum, row) => ({
      debitCents: sum.debitCents + row.debitCents,
      creditCents: sum.creditCents + row.creditCents,
    }),
    { debitCents: 0, creditCents: 0 },
  );
}

export function entryBalances(entry: JournalDraft): boolean {
  if (!entry.sourceId.trim() || entry.lines.length < 2) return false;
  for (const row of entry.lines) {
    if (isFeeAccountKey(row.accountKey)) return false;
    if (row.debitCents < 0 || row.creditCents < 0) return false;
    if (row.debitCents > 0 && row.creditCents > 0) return false;
    if (row.debitCents === 0 && row.creditCents === 0) return false;
  }
  const totals = entryTotals(entry);
  return totals.debitCents > 0 && totals.debitCents === totals.creditCents;
}

export interface TrialBalance {
  debitCents: number;
  creditCents: number;
  balanced: boolean;
  byAccount: Array<{ accountKey: ShopAccountKey; debitCents: number; creditCents: number }>;
}

export function trialBalance(entries: JournalDraft[]): TrialBalance {
  const byAccount = new Map<ShopAccountKey, { debitCents: number; creditCents: number }>();
  for (const entry of entries) {
    for (const row of entry.lines) {
      const slot = byAccount.get(row.accountKey) || { debitCents: 0, creditCents: 0 };
      slot.debitCents += row.debitCents;
      slot.creditCents += row.creditCents;
      byAccount.set(row.accountKey, slot);
    }
  }
  let debitCents = 0;
  let creditCents = 0;
  const rows = [...byAccount.entries()]
    .map(([accountKey, totals]) => {
      debitCents += totals.debitCents;
      creditCents += totals.creditCents;
      return { accountKey, ...totals };
    })
    .sort((a, b) => a.accountKey.localeCompare(b.accountKey));
  return { debitCents, creditCents, balanced: debitCents === creditCents, byAccount: rows };
}

function draft(sourceType: string, sourceId: string, date: string, memo: string, lines: JournalLineDraft[]): JournalDraft {
  const entry = { sourceType, sourceId, date, memo, lines: lines.filter((row) => row.debitCents > 0 || row.creditCents > 0) };
  if (!entryBalances(entry)) {
    throw new Error(`Unbalanced journal ${sourceType}:${sourceId}`);
  }
  return entry;
}

/** Invoice the shop job. Tax is its own payable. The fee is not invoiced here. */
export function postInvoice(input: {
  workOrderId: string;
  date: string;
  laborCents: number;
  partsCents: number;
  subletCents?: number;
  taxCents?: number;
}): JournalDraft {
  const labor = Math.max(0, Math.round(input.laborCents));
  const parts = Math.max(0, Math.round(input.partsCents));
  const sublet = Math.max(0, Math.round(input.subletCents || 0));
  const tax = Math.max(0, Math.round(input.taxCents || 0));
  const total = labor + parts + sublet + tax;
  return draft('invoice', input.workOrderId, input.date, `Invoice ${input.workOrderId}`, [
    line('accountsReceivable', total, 0, input.workOrderId),
    line('laborIncome', 0, labor, input.workOrderId),
    line('partsIncome', 0, parts, input.workOrderId),
    line('subletIncome', 0, sublet, input.workOrderId),
    line('salesTaxPayable', 0, tax, input.workOrderId),
  ]);
}

/**
 * Customer payment of the shop job. Applied to AR first.
 * Anything past the open invoice is customer credit. A missing invoice
 * credits the customer and does not create negative AR.
 */
export function postPayment(input: {
  id: string;
  workOrderId: string;
  date: string;
  amountCents: number;
  openArCents: number;
  hasInvoice: boolean;
}): JournalDraft {
  const amount = Math.max(0, Math.round(input.amountCents));
  const open = input.hasInvoice ? Math.max(0, Math.round(input.openArCents)) : 0;
  const toAr = Math.min(amount, open);
  const toCredit = amount - toAr;
  return draft('payment', input.id, input.date, `Payment ${input.workOrderId}`, [
    line('undepositedFunds', amount, 0, input.workOrderId),
    line('accountsReceivable', 0, toAr, input.workOrderId),
    line('customerCredits', 0, toCredit, input.workOrderId),
  ]);
}

/** Move undeposited shop funds into a bank deposit the bank statement will show. */
export function postBankDeposit(input: { id: string; date: string; amountCents: number; workOrderId?: string | null }): JournalDraft {
  const amount = Math.max(0, Math.round(input.amountCents));
  return draft('bank_deposit', input.id, input.date, `Bank deposit ${input.id}`, [
    line('operatingBank', amount, 0, input.workOrderId),
    line('undepositedFunds', 0, amount, input.workOrderId),
  ]);
}

export function postRefund(input: { id: string; workOrderId: string; date: string; amountCents: number }): JournalDraft {
  const amount = Math.max(0, Math.round(input.amountCents));
  return draft('refund', input.id, input.date, `Refund ${input.workOrderId}`, [
    line('refunds', amount, 0, input.workOrderId),
    line('undepositedFunds', 0, amount, input.workOrderId),
  ]);
}

export function postVendorBill(input: { id: string; date: string; amountCents: number; toInventory: boolean }): JournalDraft {
  const amount = Math.max(0, Math.round(input.amountCents));
  return draft('vendor_bill', input.id, input.date, `Vendor bill ${input.id}`, [
    line(input.toInventory ? 'inventory' : 'shopSupplies', amount, 0),
    line('accountsPayable', 0, amount),
  ]);
}

export function postBillPayment(input: { id: string; date: string; amountCents: number }): JournalDraft {
  const amount = Math.max(0, Math.round(input.amountCents));
  return draft('bill_payment', input.id, input.date, `Bill payment ${input.id}`, [
    line('accountsPayable', amount, 0),
    line('operatingBank', 0, amount),
  ]);
}

export function postInventoryReceipt(input: { id: string; date: string; amountCents: number }): JournalDraft {
  return postVendorBill({ ...input, toInventory: true });
}

export function postInventoryAdjustment(input: { id: string; date: string; amountCents: number; direction: 'increase' | 'decrease' }): JournalDraft {
  const amount = Math.max(0, Math.round(input.amountCents));
  if (input.direction === 'increase') {
    return draft('inventory_adjustment', input.id, input.date, `Inventory increase ${input.id}`, [
      line('inventory', amount, 0),
      line('ownerEquity', 0, amount),
    ]);
  }
  return draft('inventory_adjustment', input.id, input.date, `Inventory decrease ${input.id}`, [
    line('cogsParts', amount, 0),
    line('inventory', 0, amount),
  ]);
}

/** Parts leaving the shelf for a job. */
export function postPartsCogs(input: { id: string; workOrderId: string; date: string; amountCents: number }): JournalDraft {
  const amount = Math.max(0, Math.round(input.amountCents));
  return draft('cogs', input.id, input.date, `Parts cost ${input.workOrderId}`, [
    line('cogsParts', amount, 0, input.workOrderId),
    line('inventory', 0, amount, input.workOrderId),
  ]);
}

/** Clocked hours times the tech pay rate. FixTray does not withhold taxes. */
export function postPayrollAccrual(input: { id: string; date: string; amountCents: number; personId: string }): JournalDraft {
  const amount = Math.max(0, Math.round(input.amountCents));
  return draft('payroll', input.id, input.date, `Payroll accrual ${input.personId}`, [
    line('payrollExpense', amount, 0),
    line('wagesPayable', 0, amount),
  ]);
}

export interface StatementTotals {
  laborIncomeCents: number;
  partsIncomeCents: number;
  subletIncomeCents: number;
  refundsCents: number;
  salesTaxCents: number;
  cogsCents: number;
  payrollCents: number;
  shopSuppliesCents: number;
  netIncomeCents: number;
  cashCents: number;
  arCents: number;
  inventoryCents: number;
  undepositedCents: number;
  bankCents: number;
  apCents: number;
  customerCreditCents: number;
  wagesPayableCents: number;
  equityCents: number;
}

function net(balance: TrialBalance, key: ShopAccountKey): number {
  const row = balance.byAccount.find((account) => account.accountKey === key);
  if (!row) return 0;
  const naturalDebit = SHOP_ACCOUNTS[key].accountType === 'asset' || SHOP_ACCOUNTS[key].accountType === 'cogs' || SHOP_ACCOUNTS[key].accountType === 'expense';
  return naturalDebit ? row.debitCents - row.creditCents : row.creditCents - row.debitCents;
}

export function statementTotals(entries: JournalDraft[]): StatementTotals {
  const balance = trialBalance(entries);
  const laborIncomeCents = net(balance, 'laborIncome');
  const partsIncomeCents = net(balance, 'partsIncome');
  const subletIncomeCents = net(balance, 'subletIncome');
  const refundsCents = net(balance, 'refunds');
  const cogsCents = net(balance, 'cogsParts');
  const payrollCents = net(balance, 'payrollExpense');
  const shopSuppliesCents = net(balance, 'shopSupplies');
  const income = laborIncomeCents + partsIncomeCents + subletIncomeCents - refundsCents;
  const netIncomeCents = income - cogsCents - payrollCents - shopSuppliesCents;
  return {
    laborIncomeCents,
    partsIncomeCents,
    subletIncomeCents,
    refundsCents,
    salesTaxCents: net(balance, 'salesTaxPayable'),
    cogsCents,
    payrollCents,
    shopSuppliesCents,
    netIncomeCents,
    cashCents: net(balance, 'operatingBank') + net(balance, 'undepositedFunds'),
    arCents: net(balance, 'accountsReceivable'),
    inventoryCents: net(balance, 'inventory'),
    undepositedCents: net(balance, 'undepositedFunds'),
    bankCents: net(balance, 'operatingBank'),
    apCents: net(balance, 'accountsPayable'),
    customerCreditCents: net(balance, 'customerCredits'),
    wagesPayableCents: net(balance, 'wagesPayable'),
    equityCents: net(balance, 'ownerEquity') + netIncomeCents,
  };
}

export function balanceSheetBalances(entries: JournalDraft[]): boolean {
  const totals = statementTotals(entries);
  const assets = totals.bankCents + totals.undepositedCents + totals.arCents + totals.inventoryCents;
  const liabilities = totals.apCents + totals.salesTaxCents + totals.customerCreditCents + totals.wagesPayableCents;
  return assets === liabilities + totals.equityCents;
}
