import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const fleetVehicleUpdateSchema = z.object({
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  vin: z.string().optional(),
  licensePlate: z.string().optional(),
  unitNumber: z.string().optional(),
  mileage: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { id: vehicleId } = await params;
    const body = await request.json();

    // Validate input
    const validated = fleetVehicleUpdateSchema.parse(body);

    // Verify vehicle exists
    const existing = await prisma.fleetVehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    // Update vehicle
    const updated = await prisma.fleetVehicle.update({
      where: { id: vehicleId },
      data: validated,
    });

    logger.info('Fleet vehicle updated', { vehicleId });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Failed to update fleet vehicle', error);
    return NextResponse.json(
      { error: 'Failed to update fleet vehicle' },
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

    const { id: vehicleId } = await params;

    // Verify vehicle exists
    const existing = await prisma.fleetVehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    // Delete vehicle
    await prisma.fleetVehicle.delete({ where: { id: vehicleId } });

    logger.info('Fleet vehicle deleted', { vehicleId });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete fleet vehicle', error);
    return NextResponse.json(
      { error: 'Failed to delete fleet vehicle' },
      { status: 500 }
    );
  }
}
