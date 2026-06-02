/**
 * GET /api/customers/search?q=name_or_phone&shopId=xxx
 *
 * Returns customers matching the search term (name or phone).
 * Used by the Recurring Work Orders form to resolve customer names to IDs.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Only shop staff and admins may search customer PII
  if (!['shop', 'manager', 'admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const q      = request.nextUrl.searchParams.get('q') || '';
  // Non-admin callers are always scoped to their own shop
  const shopId = (auth.role === 'superadmin')
    ? (request.nextUrl.searchParams.get('shopId') || '')
    : (auth.role === 'shop' ? auth.id : (auth.shopId || ''));

  if (!q || q.length < 2) {
    return NextResponse.json({ customers: [] });
  }

  try {
    // Search by firstName+lastName (combined) or phone or email
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName:  { contains: q, mode: 'insensitive' } },
          { phone:     { contains: q } },
          { email:     { contains: q, mode: 'insensitive' } },
        ],
        ...(shopId
          ? {
              workOrders: {
                some: { shopId },
              },
            }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
      take: 10,
    });

    return NextResponse.json({ customers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
