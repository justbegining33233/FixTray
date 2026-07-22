import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const updateApprovalSchema = z.object({
  approvalStatus: z.enum(['approved', 'rejected', 'pending']).optional(),
  notes: z.string().optional(),
  nextInspectionDue: z.string().datetime().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const approval = await prisma.dviApproval.findUnique({
      where: { id },
      include: {
        vehicle: true,
        shop: { select: { id: true, shopName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!approval) {
      return NextResponse.json(
        { error: 'Approval not found' },
        { status: 404 }
      );
    }

    logger.debug('DVI approval retrieved', { id });
    return NextResponse.json(approval);
  } catch (error) {
    logger.error('Error fetching DVI approval', { error });
    return NextResponse.json(
      { error: 'Failed to fetch approval' },
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
    const validated = updateApprovalSchema.parse(body);

    // Verify approval exists
    const existing = await prisma.dviApproval.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Approval not found' },
        { status: 404 }
      );
    }

    // Update approval
    const updated = await prisma.dviApproval.update({
      where: { id },
      data: {
        ...validated,
        approvedById: auth.user?.id,
        approvedAt: new Date(),
      },
      include: {
        vehicle: true,
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    logger.info('DVI approval updated', { id, status: validated.approvalStatus });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error updating DVI approval', { error });
    return NextResponse.json(
      { error: 'Failed to update approval' },
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

    // Verify approval exists
    const existing = await prisma.dviApproval.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Approval not found' },
        { status: 404 }
      );
    }

    // Delete approval
    await prisma.dviApproval.delete({ where: { id } });

    logger.info('DVI approval deleted', { id });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting DVI approval', { error });
    return NextResponse.json(
      { error: 'Failed to delete approval' },
      { status: 500 }
    );
  }
}
