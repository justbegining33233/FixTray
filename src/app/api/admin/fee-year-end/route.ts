import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { booksAccess, isPlatformFeeYearAccount } from '@/lib/books/access';
import { accountantFeeCsv } from '@/lib/books/money';
import { loadPlatformFeeYear } from '@/lib/books/loadShopBooks';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;
  if (!isPlatformFeeYearAccount(auth.username) || !booksAccess(auth.role, auth.username).platformFeeYear) {
    return NextResponse.json({ error: 'Platform fee year-end is limited to the platform owner.' }, { status: 403 });
  }
  const url = new URL(request.url);
  const year = await loadPlatformFeeYear(url.searchParams.get('month'));
  if (url.searchParams.get('format') === 'csv') {
    const csv = accountantFeeCsv(year);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="fixtray-fee-year.csv"',
      },
    });
  }
  return NextResponse.json(year);
}
