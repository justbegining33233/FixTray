import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const swapRequestSchema = z.object({
  shiftId: z.string().min(1, 'Shift required'),
  targetId: z.string().min(1, 'Target tech required'),
  reason: z.string().optional(),
});

const swapApprovalSchema = z.object({
  status: z.enum(['approved', 'denied']),
  reason: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin', 'tech']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const status = searchParams.get('status');

    if (!shopId) {
      return NextResponse.json(
        { error: 'shopId required' },
        { status: 400 }
      );
    }

    const where: any = { shopId };
    if (status) where.status = status;

    const requests = await prisma.shiftSwapRequest.findMany({
      where,
      include: {
        shift: { include: { tech: true } },
        requester: { select: { id: true, firstName: true, lastName: true } },
        target: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.debug('Swap requests retrieved', { shopId, count: requests.length });

    return NextResponse.json(requests);
  } catch (error) {
    logger.error('Failed to fetch swap requests', error);
    return NextResponse.json(
      { error: 'Failed to fetch swap requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['tech']);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const requesterId = searchParams.get('requesterId');

    if (!shopId || !requesterId) {
      return NextResponse.json(
        { error: 'shopId and requesterId required' },
        { status: 400 }
      );
    }

    // Validate input
    const validated = swapRequestSchema.parse(body);

    // Verify shift exists and belongs to requester
    const shift = await prisma.shift.findUnique({
      where: { id: validated.shiftId },
    });

    if (!shift || shift.shopId !== shopId) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      );
    }

    if (shift.techId !== requesterId) {
      return NextResponse.json(
        { error: 'Can only request swap for your own shifts' },
        { status: 403 }
      );
    }

    // Check for existing pending request
    const existing = await prisma.shiftSwapRequest.findFirst({
      where: {
        shiftId: validated.shiftId,
        status: 'pending',
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Swap request already pending for this shift' },
        { status: 400 }
      );
    }

    // Create swap request
    const swapRequest = await prisma.shiftSwapRequest.create({
      data: {
        shopId,
        shiftId: validated.shiftId,
        requesterId,
        targetId: validated.targetId,
        reason: validated.reason,
      },
      include: {
        shift: true,
        requester: true,
        target: true,
      },
    });

    logger.info('Shift swap request created', {
      shopId,
      swapRequestId: swapRequest.id,
      requesterId,
      targetId: validated.targetId,
    });

    return NextResponse.json(swapRequest, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Failed to create swap request', error);
    return NextResponse.json(
      { error: 'Failed to create swap request' },
      { status: 500 }
    );
  }
}
