import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { booksAccess, shopIdForBooks } from '@/lib/books/access';
import { loadShopFacts, shopTimeZone } from '@/lib/books/loadTruth';
import { shopDateSpan } from '@/lib/books/periods';
import { taxForInvoice, taxSettingsFromShop } from '@/lib/books/shopTax';
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
  const [zone, settings, facts] = await Promise.all([
    shopTimeZone(shopId),
    prisma.shopSettings.findUnique({ where: { shopId }, select: { taxRate: true, laborTaxable: true, partsTaxable: true } }).catch(() => null),
    loadShopFacts(shopId),
  ]);
  const settingsView = taxSettingsFromShop(settings);
  const span = shopDateSpan(from, to, zone);
  let taxableCents = 0;
  let taxCents = 0;
  for (const job of facts) {
    const invoice = job.events.find((event) => event.kind === 'invoice' && new Date(event.at) >= span.start && new Date(event.at) < span.end);
    if (!invoice) continue;
    const tax = taxForInvoice({
      invoiceCents: invoice.cents,
      partsSellCents: job.partsSellCents,
      settings: settingsView,
      frozen: job.salesTax,
    });
    const laborTaxable = job.salesTax ? job.salesTax.laborTaxable : settingsView.laborTaxable;
    const partsTaxable = job.salesTax ? job.salesTax.partsTaxable : settingsView.partsTaxable;
    if (laborTaxable) taxableCents += tax.laborBaseCents;
    if (partsTaxable) taxableCents += tax.partsBaseCents;
    taxCents += tax.taxCents;
  }
  return NextResponse.json({
    from,
    to,
    timeZone: zone,
    settings: settingsView,
    taxableCents,
    taxCents,
    readOnly: booksAccess(auth.role).accountantRead,
    note: settingsView.ratePercent <= 0 ? 'No sales tax until the shop owner sets a rate.' : 'Tax uses the owner rate and the labor or parts flags. Each invoice is taxed once.',
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
