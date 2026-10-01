import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole, AuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const user = auth as AuthUser;
  const { searchParams } = new URL(request.url);
  // For shop/manager use their own shopId; admins may query any shop via ?shopId=
  const shopId = user.role === 'admin'
    ? searchParams.get('shopId')
    : (user.shopId ?? user.id);

  if (!shopId) {
    return NextResponse.json({ error: 'Shop ID is required' }, { status: 400 });
  }

  // Managers keep outstanding bills for closeout. Shop income stays off this response.
  if (user.role === 'manager') {
    try {
      const outstandingInvoices = await prisma.workOrder.aggregate({
        where: {
          shopId,
          paymentStatus: 'unpaid',
        },
        _sum: {
          estimatedCost: true,
        },
      });
      return NextResponse.json({
        summary: {
          outstandingInvoices: outstandingInvoices._sum.estimatedCost || 0,
        },
      });
    } catch (error) {
      console.error('Error fetching outstanding invoices:', error);
      return NextResponse.json({ error: 'Failed to fetch financial summary' }, { status: 500 });
    }
  }

  try {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get financial data
    const [todayRevenue, weeklyRevenue, monthlyRevenue, outstandingInvoices] = await Promise.all([
      // Today's revenue (completed work orders)
      prisma.workOrder.aggregate({
        where: {
          shopId,
          status: 'closed',
          updatedAt: {
            gte: startOfToday,
          },
        },
        _sum: {
          amountPaid: true,
        },
      }),

      // Weekly revenue
      prisma.workOrder.aggregate({
        where: {
          shopId,
          status: 'closed',
          updatedAt: {
            gte: startOfWeek,
          },
        },
        _sum: {
          amountPaid: true,
        },
      }),

      // Monthly revenue
      prisma.workOrder.aggregate({
        where: {
          shopId,
          status: 'closed',
          updatedAt: {
            gte: startOfMonth,
          },
        },
        _sum: {
          amountPaid: true,
        },
      }),

      // Outstanding invoices (unpaid work orders)
      prisma.workOrder.aggregate({
        where: {
          shopId,
          paymentStatus: 'unpaid',
        },
        _sum: {
          estimatedCost: true,
        },
      }),
    ]);

    const summary = {
      todayRevenue: todayRevenue._sum.amountPaid || 0,
      weeklyRevenue: weeklyRevenue._sum.amountPaid || 0,
      monthlyRevenue: monthlyRevenue._sum.amountPaid || 0,
      outstandingInvoices: outstandingInvoices._sum.estimatedCost || 0,
    };

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    return NextResponse.json({ error: 'Failed to fetch financial summary' }, { status: 500 });
  }
}