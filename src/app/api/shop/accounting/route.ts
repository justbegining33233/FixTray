import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { booksAccess, shopIdForBooks } from '@/lib/books/access';
import { loadShopFacts, shopTimeZone } from '@/lib/books/loadTruth';
import { shopDateSpan } from '@/lib/books/periods';
import { rangeSnapshot } from '@/lib/books/truth';
import { balanceSheetBalances, statementTotals, trialBalance } from '@/lib/books/journal';
import { journalForFacts } from '@/lib/books/statements';
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
  const entries = journalForFacts(facts, span.start, span.end, tax, zone);
  const books = rangeSnapshot(facts, span.start, span.end);
  const statements = statementTotals(entries);
  const balance = trialBalance(entries);
  return NextResponse.json({
    from,
    to,
    timeZone: zone,
    books: {
      invoicedCents: books.invoicedCents,
      paidCents: books.paidCents,
      revenueCents: books.revenueCents,
      arCents: books.arCents,
      customerCreditCents: books.customerCreditCents,
    },
    profitAndLoss: statements,
    balanceSheetBalances: entries.length === 0 || balanceSheetBalances(entries),
    trialBalance: balance,
    readOnly: booksAccess(auth.role).accountantRead,
  });
}
