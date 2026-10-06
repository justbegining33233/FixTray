import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { dollars, groupFeeMovementsByMonth, loadFeeMovements, reportZone } from '@/lib/books/storedFeeReport';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  }

  try {
    const zone = await reportZone();
    const movements = await loadFeeMovements();
    const months = groupFeeMovementsByMonth(movements, zone);
    const year = months.reduce((sum, month) => ({
      collectedCents: sum.collectedCents + month.collectedCents,
      accruedCents: sum.accruedCents + month.accruedCents,
      settledCents: sum.settledCents + month.settledCents,
      owedCents: sum.owedCents + month.owedCents,
      refundedCents: sum.refundedCents + month.refundedCents,
      netCents: sum.netCents + month.netCents,
    }), {
      collectedCents: 0,
      accruedCents: 0,
      settledCents: 0,
      owedCents: 0,
      refundedCents: 0,
      netCents: 0,
    });

    return NextResponse.json({
      shopBayRevenueIncluded: false,
      timeZone: zone,
      collected: dollars(year.collectedCents),
      accrued: dollars(year.accruedCents),
      owed: dollars(year.owedCents),
      refunded: dollars(year.refundedCents),
      net: dollars(year.netCents),
      // Older clients read these keys. They are fee totals, not shop payouts.
      totalRevenue: dollars(year.collectedCents),
      totalPayouts: dollars(year.owedCents),
      platformFees: dollars(year.netCents),
      pendingPayouts: dollars(year.refundedCents),
      averageTransaction: months.length > 0 ? dollars(Math.round(year.netCents / months.length)) : '$0.00',
      transactionCount: movements.length,
      monthlyData: months.slice(-12).map((month) => ({
        month: month.label,
        collected: dollars(month.collectedCents),
        accrued: dollars(month.accruedCents),
        owed: dollars(month.owedCents),
        refunds: dollars(month.refundedCents),
        net: dollars(month.netCents),
        revenue: dollars(month.collectedCents),
        payouts: dollars(month.owedCents),
        fees: dollars(month.netCents),
      })),
      topEarningShops: [],
    });
  } catch (error) {
    console.error('Error fetching financial reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
