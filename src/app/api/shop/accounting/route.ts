import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { booksAccess, shopIdForBooks } from '@/lib/books/access';
import { loadShopFacts, shopTimeZone } from '@/lib/books/loadTruth';
import { shopDateSpan } from '@/lib/books/periods';
import { rangeSnapshot } from '@/lib/books/truth';
import { balanceSheetView, postInventoryAdjustment, statementTotals, trialBalance } from '@/lib/books/journal';
import { cashBasisIncome, journalForFacts } from '@/lib/books/statements';
import { taxSettingsFromShop } from '@/lib/books/shopTax';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'accountant']);
  if (auth instanceof NextResponse) return auth;
  if (!booksAccess(auth.role).shopRevenue) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'Choose from and to dates' }, { status: 400 });
  }
  const zone = await shopTimeZone(shopId);
  const span = shopDateSpan(from, to, zone);
  const [facts, settings] = await Promise.all([
    loadShopFacts(shopId),
    prisma.shopSettings.findUnique({ where: { shopId }, select: { taxRate: true, laborTaxable: true, partsTaxable: true } }).catch(() => null),
  ]);
  const tax = taxSettingsFromShop(settings);
  const periodEntries = journalForFacts(facts, span.start, span.end, tax, zone);
  const asOfEntries = journalForFacts(facts, new Date('2000-01-01T00:00:00.000Z'), span.end, tax, zone);
  const books = rangeSnapshot(facts, span.start, span.end, zone);
  const period = statementTotals(periodEntries);
  const cash = cashBasisIncome({
    revenueCents: books.revenueCents,
    cogsCents: period.cogsCents,
    payrollCents: period.payrollCents,
    shopSuppliesCents: period.shopSuppliesCents,
  });
  let inventoryCents = 0;
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { shopId },
      select: { quantity: true, costCents: true },
    });
    inventoryCents = items.reduce((sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.costCents || 0), 0);
  } catch {
    inventoryCents = 0;
  }
  if (inventoryCents > 0) {
    asOfEntries.push(postInventoryAdjustment({
      id: `inventory:${shopId}:${to}`,
      date: to,
      amountCents: inventoryCents,
      direction: 'increase',
    }));
  }
  const sheet = balanceSheetView(asOfEntries);
  const balance = trialBalance(asOfEntries);
  return NextResponse.json({
    from,
    to,
    timeZone: zone,
    basis: cash.basis,
    basisNote: cash.note,
    books: {
      invoicedCents: books.invoicedCents,
      paidCents: books.paidCents,
      revenueCents: books.revenueCents,
      arCents: books.arCents,
      customerCreditCents: books.customerCreditCents,
    },
    profitAndLoss: {
      ...period,
      basis: cash.basis,
      revenueCents: cash.revenueCents,
      netIncomeCents: cash.netIncomeCents,
      accrualInvoicedCents: books.invoicedCents,
      accrualNetIncomeCents: period.netIncomeCents,
      note: cash.note,
    },
    balanceSheet: sheet,
    balanceSheetBalances: sheet.balanced,
    trialBalance: balance,
    readOnly: booksAccess(auth.role).accountantRead,
  });
}
