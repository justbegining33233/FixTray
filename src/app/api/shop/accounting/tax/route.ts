import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { booksAccess, shopIdForBooks } from '@/lib/books/access';
import { shopTimeZone } from '@/lib/books/loadTruth';
import { shopDateSpan } from '@/lib/books/periods';
import { taxSettingsFromShop } from '@/lib/books/shopTax';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'accountant']);
  if (auth instanceof NextResponse) return auth;
  if (!booksAccess(auth.role).shopLedger) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const url = new URL(request.url);
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'Choose from and to dates' }, { status: 400 });
  }
  const [zone, settings, collected] = await Promise.all([
    shopTimeZone(shopId),
    prisma.shopSettings.findUnique({ where: { shopId }, select: { taxRate: true, laborTaxable: true, partsTaxable: true } }).catch(() => null),
    prisma.journalEntry.findMany({
      where: { shopId, sourceType: 'sales_tax' },
      select: { entryDate: true, lines: { select: { accountKey: true, creditCents: true } } },
    }).catch(() => []),
  ]);
  const settingsView = taxSettingsFromShop(settings);
  const span = shopDateSpan(from, to, zone);
  let taxCents = 0;
  for (const entry of collected) {
    if (entry.entryDate < span.start || entry.entryDate >= span.end) continue;
    taxCents += entry.lines
      .filter((line) => line.accountKey === 'salesTaxPayable')
      .reduce((sum, line) => sum + line.creditCents, 0);
  }
  return NextResponse.json({
    from,
    to,
    timeZone: zone,
    settings: settingsView,
    taxableCents: 0,
    taxCents,
    readOnly: booksAccess(auth.role).accountantRead,
    note: 'Collected tax is tax the customer paid. Uncollected tax is not on this report, not accounts receivable, and not tax payable.',
  });
}

/** Owner sets the rate and which of labor or parts are taxable. Default remains no tax. */
export async function PATCH(request: NextRequest) {
  const auth = requireRole(request, ['shop']);
  if (auth instanceof NextResponse) return auth;
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const ratePercent = Number(body?.ratePercent);
  if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 30) {
    return NextResponse.json({ error: 'Enter a sales tax percent from 0 to 30' }, { status: 400 });
  }
  const settings = await prisma.shopSettings.upsert({
    where: { shopId },
    update: {
      taxRate: ratePercent / 100,
      laborTaxable: body?.laborTaxable === true,
      partsTaxable: body?.partsTaxable === true,
    },
    create: {
      shopId,
      taxRate: ratePercent / 100,
      laborTaxable: body?.laborTaxable === true,
      partsTaxable: body?.partsTaxable === true,
    },
  });
  return NextResponse.json({ settings: taxSettingsFromShop(settings) });
}
