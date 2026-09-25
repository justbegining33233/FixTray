import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';
import { getLeaveBalance } from '@/lib/leaveService';

const leaveRequestSchema = z.object({
  techId: z.string().min(1, 'Tech required'),
  leaveType: z.enum(['vacation', 'sick', 'personal', 'bereavement', 'parental']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().min(1, 'Reason required'),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin', 'tech']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const status = searchParams.get('status');
    const techId = searchParams.get('techId');

    if (searchParams.get('action') === 'balance') {
      const requestedId = techId || (auth.role === 'tech' ? auth.id : '');
      if (!requestedId) {
        return NextResponse.json({ error: 'techId required' }, { status: 400 });
      }
      if (auth.role === 'tech' && requestedId !== auth.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      try {
        const balance = await getLeaveBalance(requestedId);
        return NextResponse.json({
          vacation: balance.available,
          sick: balance.byType.sick || 0,
          personal: balance.byType.personal || 0,
          bereavement: balance.byType.bereavement || 0,
          parental: balance.byType.parental || 0,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Tech not found')) {
          return NextResponse.json({ error: 'Tech not found' }, { status: 404 });
        }
        logger.error('Failed to fetch leave balance', { error: message });
        return NextResponse.json({ error: 'Failed to fetch leave balance' }, { status: 500 });
      }
    }

    if (!shopId) {
      return NextResponse.json(
        { error: 'shopId required' },
        { status: 400 }
      );
    }

    const where: any = { shopId };
    if (status) where.status = status;
    if (techId) where.techId = techId;

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        tech: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.debug('Leave requests retrieved', { shopId, count: requests.length });

    return NextResponse.json(requests);
  } catch (error) {
    logger.error('Failed to fetch leave requests', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch leave requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin', 'tech']);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');

    if (!shopId) {
      return NextResponse.json(
        { error: 'shopId required' },
        { status: 400 }
      );
    }

    // Validate input
    const validated = leaveRequestSchema.parse(body);

    const startDate = new Date(validated.startDate);
    const endDate = new Date(validated.endDate);

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    // Calculate total hours (assuming 8-hour days)
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const totalHours = days * 8;

    // Check for overlapping leave requests
    const existing = await prisma.leaveRequest.findFirst({
      where: {
        shopId,
        techId: validated.techId,
        status: { not: 'denied' },
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Tech already has leave during this period' },
        { status: 400 }
      );
    }

    // Create leave request
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        ...validated,
        shopId,
        startDate,
        endDate,
        totalHours,
      },
      include: {
        tech: true,
      },
    });

    logger.info('Leave request created', {
      shopId,
      leaveRequestId: leaveRequest.id,
      techId: validated.techId,
      leaveType: validated.leaveType,
      days,
    });

    return NextResponse.json(leaveRequest, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Failed to create leave request', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to create leave request' },
      { status: 500 }
    );
  }
}
