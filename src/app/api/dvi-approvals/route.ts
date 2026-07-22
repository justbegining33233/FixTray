import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const dviApprovalSchema = z.object({
  inspectionId: z.string().min(1, 'Inspection ID required'),
  vehicleId: z.string().min(1, 'Vehicle ID required'),
  approvalStatus: z.enum(['approved', 'rejected']),
  notes: z.string().optional(),
  inspectionDate: z.string().datetime().optional(),
  nextInspectionDue: z.string().datetime().optional(),
  shopId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const vehicleId = searchParams.get('vehicleId');
    const pending = searchParams.get('pending') === 'true';

    const where: any = { shopId: auth.user?.shopId };
    if (status) where.approvalStatus = status;
    if (vehicleId) where.vehicleId = vehicleId;
    if (pending) where.approvalStatus = 'pending';

    const approvals = await prisma.dviApproval.findMany({
      where,
      include: {
        vehicle: true,
        shop: { select: { id: true, shopName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.info('Retrieved DVI approvals', { count: approvals.length, shopId: auth.user?.shopId });
    return NextResponse.json(approvals);
  } catch (error) {
    logger.error('Error getting DVI approvals', { error });
    return NextResponse.json(
      { error: 'Failed to fetch approvals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const validated = dviApprovalSchema.parse(body);

    // Verify vehicle exists
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: validated.vehicleId },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    // Create or update DVI approval
    const approval = await prisma.dviApproval.create({
      data: {
        inspectionId: validated.inspectionId,
        vehicleId: validated.vehicleId,
        approvalStatus: validated.approvalStatus,
        notes: validated.notes,
        inspectionDate: validated.inspectionDate,
        nextInspectionDue: validated.nextInspectionDue,
        approvedById: auth.user?.id,
        approvedAt: new Date(),
        shopId: auth.user?.shopId,
      },
      include: {
        vehicle: true,
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    logger.info('DVI approval created', {
      approvalId: approval.id,
      vehicleId: approval.vehicleId,
      status: approval.approvalStatus,
    });

    return NextResponse.json(approval, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error creating DVI approval', { error });
    return NextResponse.json(
      { error: 'Failed to create approval' },
      { status: 500 }
    );
  }
}
