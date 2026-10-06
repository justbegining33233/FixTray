import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { booksAccess, shopIdForBooks } from '@/lib/books/access';
import { shopTimeZone } from '@/lib/books/loadTruth';
import { dayKey } from '@/lib/books/periods';

export const dynamic = 'force-dynamic';

/** Timesheets for the shop. FixTray does not withhold taxes or pay the staff. */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'accountant']);
  if (auth instanceof NextResponse) return auth;
  if (!booksAccess(auth.role).shopLedger) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const zone = await shopTimeZone(shopId);
  const rows = await prisma.timeEntry.findMany({
    where: { shopId },
    include: { tech: { select: { firstName: true, lastName: true, hourlyRate: true } } },
    orderBy: { clockIn: 'asc' },
  });
  const header = 'date,person,clocked_hours,hourly_rate,gross_cents,note';
  const lines = rows.map((row) => {
    const hours = row.hoursWorked || 0;
    const rate = row.tech.hourlyRate || 0;
    const gross = rate > 0 ? Math.round(hours * rate * 100) : 0;
    const name = `${row.tech.firstName} ${row.tech.lastName}`.replace(/,/g, ' ');
    const note = rate > 0 ? 'hours times pay rate' : 'rate not set';
    return [dayKey(row.clockIn, zone), name, hours.toFixed(2), rate.toFixed(2), String(gross), note].join(',');
  });
  const csv = [header, ...lines].join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="timesheets.csv"',
    },
  });
}
