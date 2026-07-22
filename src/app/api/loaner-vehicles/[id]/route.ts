import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const checkoutSchema = z.object({
  customerId: z.string().min(1, 'Customer required'),
  workOrderId: z.string().min(1, 'Work order required'),
  mileageOut: z.number().int().min(0),
  fuelLevelOut: z.enum(['empty', 'quarter', 'half', 'three-quarter', 'full']),
  expectedBackDate: z.string().datetime().optional(),
});

const checkinSchema = z.object({
  mileageIn: z.number().int().min(0),
  fuelLevelIn: z.enum(['empty', 'quarter', 'half', 'three-quarter', 'full']),
  damageNotes: z.string().optional(),
  photos: z.array(z.string()).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Verify vehicle exists
    const vehicle = await prisma.loanerVehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Loaner vehicle not found' },
        { status: 404 }
      );
    }

    // Handle checkout
    if (action === 'checkout') {
      const validated = checkoutSchema.parse(body);

      if (vehicle.status !== 'available') {
        return NextResponse.json(
          { error: `Vehicle is ${vehicle.status}` },
          { status: 400 }
        );
      }

      const updated = await prisma.loanerVehicle.update({
        where: { id },
        data: {
          customerId: validated.customerId,
          workOrderId: validated.workOrderId,
          mileageOut: validated.mileageOut,
          fuelLevelOut: validated.fuelLevelOut,
          checkedOutAt: new Date(),
          expectedBack: validated.expectedBackDate ? new Date(validated.expectedBackDate) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days default
          status: 'checked-out',
        },
      });

      logger.info('Loaner vehicle checked out', {
        vehicleId: id,
        customerId: validated.customerId,
        workOrderId: validated.workOrderId,
      });

      return NextResponse.json(updated);
    }

    // Handle checkin
    if (action === 'checkin') {
      const validated = checkinSchema.parse(body);

      if (vehicle.status !== 'checked-out') {
        return NextResponse.json(
          { error: 'Vehicle must be checked out to check in' },
          { status: 400 }
        );
      }

      const updated = await prisma.loanerVehicle.update({
        where: { id },
        data: {
          mileageIn: validated.mileageIn,
          fuelLevelIn: validated.fuelLevelIn,
          damageNotes: validated.damageNotes,
          photos: validated.photos ? JSON.stringify(validated.photos) : null,
          checkedInAt: new Date(),
          status: 'available',
        },
      });

      logger.info('Loaner vehicle checked in', {
        vehicleId: id,
        mileageDriven: (validated.mileageIn || 0) - (vehicle.mileageOut || 0),
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Failed to update loaner vehicle', error);
    return NextResponse.json(
      { error: 'Failed to update loaner vehicle' },
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

    // Verify vehicle exists
    const vehicle = await prisma.loanerVehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Loaner vehicle not found' },
        { status: 404 }
      );
    }

    if (vehicle.status === 'checked-out') {
      return NextResponse.json(
        { error: 'Cannot delete checked-out vehicle' },
        { status: 400 }
      );
    }

    // Mark as retired instead of deleting
    await prisma.loanerVehicle.update({
      where: { id },
      data: { status: 'retired' },
    });

    logger.info('Loaner vehicle retired', { vehicleId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete loaner vehicle', error);
    return NextResponse.json(
      { error: 'Failed to delete loaner vehicle' },
      { status: 500 }
    );
  }
}
