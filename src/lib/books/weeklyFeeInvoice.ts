/**
 * Monday morning in the report timezone, email each shop the prior week's
 * open in-person FixTray fees. A shop with nothing owed is skipped.
 * The same shop and week are not emailed twice.
 */

import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/emailService';
import { inPersonFeeInvoice, inPersonFeeOwed } from '@/lib/books/money';
import { logAdminAction } from '@/lib/auditLog';
import { addDays, dayKey, mondayKey, reportTimeZone, weekdayIndex, zonedDayStart } from '@/lib/books/periods';

export function weeklyFeeInvoiceWindow(now: Date, timeZone: string): { due: false } | {
  due: true;
  weekLabel: string;
  start: Date;
  end: Date;
} {
  const zone = reportTimeZone(timeZone);
  const today = dayKey(now, zone);
  if (weekdayIndex(today) !== 1) return { due: false };
  const weekLabel = mondayKey(addDays(today, -1));
  return {
    due: true,
    weekLabel,
    start: zonedDayStart(weekLabel, zone),
    end: zonedDayStart(addDays(weekLabel, 7), zone),
  };
}

export async function emailWeeklyFixtrayInvoices(now = new Date()): Promise<{
  due: boolean;
  sent: number;
  skipped: number;
}> {
  let zone = 'America/New_York';
  try {
    const config = await prisma.platformConfig.findUnique({ where: { id: 'global' }, select: { timezone: true } });
    zone = reportTimeZone(config?.timezone);
  } catch {
    zone = reportTimeZone(null);
  }
  const window = weeklyFeeInvoiceWindow(now, zone);
  if (!window.due) return { due: false, sent: 0, skipped: 0 };

  const shops = await prisma.shop.findMany({ select: { id: true, shopName: true, email: true } });
  let sent = 0;
  let skipped = 0;
  for (const shop of shops) {
    const already = await prisma.auditLog.findFirst({
      where: { action: 'books.fee_invoice_auto', shopId: shop.id, targetId: window.weekLabel },
    });
    if (already) {
      skipped += 1;
      continue;
    }
    const entries = await prisma.booksEntry.findMany({
      where: { shopId: shop.id, appliesTo: 'fee', createdAt: { gte: window.start, lt: window.end } },
    });
    const rows = entries.filter((entry) => !String(entry.note || '').toLowerCase().includes('opening balance'));
    const owed = inPersonFeeOwed(rows, { start: window.start, end: window.end });
    if (owed.owedCents <= 0) {
      skipped += 1;
      continue;
    }
    const invoice = inPersonFeeInvoice({
      shopName: shop.shopName || 'Shop',
      weekLabel: window.weekLabel,
      owed,
    });
    if (shop.email) {
      await sendEmail({
        to: shop.email,
        subject: invoice.subject,
        html: `<p>${invoice.text.replace(/\n/g, '<br>')}</p>`,
        from: 'FixTray Support <support@fixtray.app>',
        shopId: shop.id,
      });
    }
    await logAdminAction('system', 'books.fee_invoice_auto', invoice.text, {
      targetId: window.weekLabel,
      targetType: 'shop',
      shopId: shop.id,
    });
    sent += 1;
  }
  return { due: true, sent, skipped };
}
