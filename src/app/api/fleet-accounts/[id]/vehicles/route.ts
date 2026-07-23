import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const fleetVehicleSchema = z.object({
  make: z.string().min(1, 'Make required'),
  model: z.string().min(1, 'Model required'),
  year: z.number().int().min(1900).max(2100),
  vin: z.string().optional(),
  licensePlate: z.string().optional(),
  unitNumber: z.string().optional(),
  mileage: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { id: fleetAccountId } = await params;

    // Verify fleet account exists
    const fleetAccount = await prisma.fleetAccount.findUnique({
      where: { id: fleetAccountId },
    });

    if (!fleetAccount) {
      return NextResponse.json(
        { error: 'Fleet account not found' },
        { status: 404 }
      );
    }

    // Get all vehicles for this fleet
    const vehicles = await prisma.fleetVehicle.findMany({
      where: { fleetAccountId },
      orderBy: { createdAt: 'desc' },
    });

    logger.debug('Fleet vehicles retrieved', {
      fleetAccountId,
      count: vehicles.length,
    });

    return NextResponse.json(vehicles);
  } catch (error) {
    logger.error('Failed to fetch fleet vehicles', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch fleet vehicles' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { id: fleetAccountId } = await params;
    const body = await request.json();

    // Verify fleet account exists
    const fleetAccount = await prisma.fleetAccount.findUnique({
      where: { id: fleetAccountId },
    });

    if (!fleetAccount) {
      return NextResponse.json(
        { error: 'Fleet account not found' },
        { status: 404 }
      );
    }

    // Validate input
    const validated = fleetVehicleSchema.parse(body);

    // Create vehicle
    const vehicle = await prisma.fleetVehicle.create({
      data: {
        ...validated,
        fleetAccountId,
      },
    });

    logger.info('Fleet vehicle added', {
      fleetAccountId,
      vehicleId: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
    });

    return NextResponse.json(vehicle, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Failed to add fleet vehicle', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to add fleet vehicle' },
      { status: 500 }
    );
  }
}
