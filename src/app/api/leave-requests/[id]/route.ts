import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const leaveRequestUpdateSchema = z.object({
  reason: z.string().min(1).optional(),
  notes: z.string().optional(),
  status: z.enum(['pending', 'approved', 'denied']).optional(),
  approvedById: z.string().optional(),
  deniedReason: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin', 'tech']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        tech: { select: { id: true, firstName: true, lastName: true, email: true } },
        shop: { select: { id: true, shopName: true } },
      },
    });

    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }

    logger.debug('Leave request retrieved', { id });

    return NextResponse.json(leaveRequest);
  } catch (error) {
    logger.error('Failed to fetch leave request', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch leave request' },
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
    const validated = leaveRequestUpdateSchema.parse(body);

    // Verify leave request exists
    const existing = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }

    if (existing.status !== 'pending' && validated.status) {
      return NextResponse.json(
        { error: 'Cannot change status of already processed leave request' },
        { status: 400 }
      );
    }

    // Update leave request
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        ...validated,
        approvedAt: validated.status === 'approved' ? new Date() : undefined,
      },
      include: {
        tech: true,
      },
    });

    logger.info('Leave request updated', {
      id,
      status: validated.status,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Failed to update leave request', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to update leave request' },
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

    // Verify leave request exists
    const existing = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }

    // Only allow deletion of pending requests
    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: 'Cannot delete processed leave requests' },
        { status: 400 }
      );
    }

    // Delete leave request
    await prisma.leaveRequest.delete({ where: { id } });

    logger.info('Leave request deleted', { id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete leave request', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to delete leave request' },
      { status: 500 }
    );
  }
}
