import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.role !== 'superadmin' && auth.role !== 'shop' && auth.role !== 'manager') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Record<string, unknown> = {};
    if (auth.role === 'shop') where.shopId = auth.id;
    if (auth.role === 'manager' && auth.shopId) where.shopId = auth.shopId;

    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      };
    }

    const workOrders = await prisma.workOrder.findMany({
      where,
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
        shop: { select: { shopName: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'json') {
      return NextResponse.json({ workOrders, exportedAt: new Date().toISOString(), total: workOrders.length });
    }

    // CSV export
    const headers = ['ID', 'Status', 'Customer', 'Customer Email', 'Shop', 'Assigned Tech', 'Issue', 'Estimated Cost', 'Amount Paid', 'Created', 'Completed'];
    const rows = workOrders.map(wo => [
      wo.id,
      wo.status,
      wo.customer ? `${wo.customer.firstName} ${wo.customer.lastName}` : '',
      wo.customer?.email || '',
      wo.shop?.shopName || '',
      wo.assignedTo ? `${wo.assignedTo.firstName} ${wo.assignedTo.lastName}` : '',
      `"${(wo.issueDescription || '').replace(/"/g, '""')}"`,
      wo.estimatedCost?.toString() || '0',
      wo.amountPaid?.toString() || '0',
      wo.createdAt.toISOString(),
      wo.completedAt?.toISOString() || '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="analytics-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting analytics:', error);
    return NextResponse.json({ error: 'Failed to export analytics' }, { status: 500 });
  }
}
