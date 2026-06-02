import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    // Get all shops (these are your clients)
    const clients = await prisma.shop.findMany({
      include: {
        _count: {
          select: {
            workOrders: true,
            techs: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Generate CSV content
    const headers = [
      'Shop Name',
      'Owner Name',
      'Email',
      'Phone',
      'Shop Type',
      'Status',
      'Work Orders',
      'Technicians',
      'Created At'
    ];

    const rows = clients.map((client: any) => [
      client.shopName || '',
      client.ownerName || '',
      client.email || '',
      client.phone || '',
      client.shopType || '',
      client.status || '',
      client._count?.workOrders?.toString() || '0',
      client._count?.techs?.toString() || '0',
      client.createdAt ? new Date(client.createdAt).toISOString().split('T')[0] : ''
    ]);

    // Create CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Return as downloadable CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="fixtray-clients-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    console.error('Error exporting clients:', error);
    return NextResponse.json(
      { error: 'Failed to export clients' },
      { status: 500 }
    );
  }
}
