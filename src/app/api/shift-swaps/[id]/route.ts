import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const approvalSchema = z.object({
  status: z.enum(['approved', 'denied']),
  reason: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const swapRequest = await prisma.shiftSwapRequest.findUnique({
      where: { id },
      include: {
        shift: { include: { tech: true } },
        requester: true,
        target: true,
        shop: { select: { id: true, shopName: true } },
      },
    });

    if (!swapRequest) {
      return NextResponse.json(
        { error: 'Swap request not found' },
        { status: 404 }
      );
    }

    logger.debug('Swap request retrieved', { id });

    return NextResponse.json(swapRequest);
  } catch (error) {
    logger.error('Failed to fetch swap request', error);
    return NextResponse.json(
      { error: 'Failed to fetch swap request' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validated = approvalSchema.parse(body);

    // Verify swap request exists
    const swapRequest = await prisma.shiftSwapRequest.findUnique({
      where: { id },
      include: { shift: true },
    });

    if (!swapRequest) {
      return NextResponse.json(
        { error: 'Swap request not found' },
        { status: 404 }
      );
    }

    if (swapRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only approve/deny pending requests' },
        { status: 400 }
      );
    }

    if (validated.status === 'approved' && swapRequest.targetId) {
      // Swap the shift assignments
      const shift = swapRequest.shift;
      
      // Update shift to be assigned to target tech
      await prisma.shift.update({
        where: { id: shift.id },
        data: { techId: swapRequest.targetId },
      });

      logger.info('Shift assigned to target tech', {
        shiftId: shift.id,
        oldTechId: shift.techId,
        newTechId: swapRequest.targetId,
      });
    }

    // Update swap request
    const updated = await prisma.shiftSwapRequest.update({
      where: { id },
      data: {
        status: validated.status === 'approved' ? 'approved' : 'denied',
        approvedAt: new Date(),
      },
      include: {
        shift: true,
        requester: true,
        target: true,
      },
    });

    logger.info('Shift swap request approved/denied', {
      id,
      status: updated.status,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Failed to approve swap request', error);
    return NextResponse.json(
      { error: 'Failed to approve swap request' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['shop_owner', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    // Verify swap request exists
    const existing = await prisma.shiftSwapRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Swap request not found' },
        { status: 404 }
      );
    }

    // Delete swap request
    await prisma.shiftSwapRequest.delete({ where: { id } });

    logger.info('Shift swap request deleted', { id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete swap request', error);
    return NextResponse.json(
      { error: 'Failed to delete swap request' },
      { status: 500 }
    );
  }
}
