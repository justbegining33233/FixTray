import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import { booksAccess, shopIdForBooks } from '@/lib/books/access';
import { loadShopFacts, shopTimeZone } from '@/lib/books/loadTruth';
import { arAging } from '@/lib/books/truth';

const LABELS = {
  current: { range: '0-30 days', days: 'Current' },
  '30': { range: '31-60 days', days: '31-60 days' },
  '60': { range: '61-90 days', days: '61-90 days' },
  '90': { range: '90+ days', days: 'Over 90 days' },
} as const;

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!booksAccess(auth.role).shopRevenue) {
    return NextResponse.json({ error: 'Shop revenue is not available to this role.' }, { status: 403 });
  }
  const shopId = shopIdForBooks(auth) || (auth.role === 'shop' ? auth.id : auth.shopId);
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });

  try {
    const [facts, zone, customers] = await Promise.all([
      loadShopFacts(shopId),
      shopTimeZone(shopId),
      prisma.workOrder.findMany({
        where: { shopId },
        select: {
          id: true,
          vehicleType: true,
          customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        },
      }),
    ]);
    const names = new Map(customers.map((row) => [row.id, row]));
    const aged = arAging(facts, new Date(), zone);
    const buckets = (Object.keys(LABELS) as Array<keyof typeof LABELS>).map((key) => {
      const rows = aged.filter((row) => row.bucket === key);
      const invoices = rows.map((row) => {
        const order = names.get(row.workOrderId);
        const customer = order?.customer;
        return {
          id: row.workOrderId,
          total: row.arCents / 100,
          remaining: row.arCents / 100,
          daysOutstanding: row.ageDays,
          customer: {
            name: customer ? `${customer.firstName} ${customer.lastName}`.trim() : 'Unknown',
            email: customer?.email,
            phone: customer?.phone,
          },
          workOrder: { vehicle: order?.vehicleType },
          flags: row.flags,
        };
      });
      return {
        range: LABELS[key].range,
        days: LABELS[key].days,
        count: invoices.length,
        total: invoices.reduce((sum, row) => sum + row.total, 0),
        invoices,
      };
    }).filter((bucket) => bucket.count > 0);
    const totalOutstanding = buckets.reduce((sum, bucket) => sum + bucket.total, 0);
    return NextResponse.json({
      buckets,
      totalOutstanding,
      flags: [...new Set(aged.flatMap((row) => row.flags))],
    });
  } catch (err) {
    console.error('ar-aging GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
