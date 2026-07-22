import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const loanerVehicleSchema = z.object({
  make: z.string().min(1, 'Make required'),
  model: z.string().min(1, 'Model required'),
  year: z.number().int().min(1900).max(2100),
  color: z.string().optional(),
  licensePlate: z.string(),
  vin: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
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

    const vehicles = await prisma.loanerVehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    logger.debug('Loaner vehicles retrieved', { shopId, count: vehicles.length });

    return NextResponse.json(vehicles);
  } catch (error) {
    logger.error('Failed to fetch loaner vehicles', error);
    return NextResponse.json(
      { error: 'Failed to fetch loaner vehicles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
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
    const validated = loanerVehicleSchema.parse(body);

    // Check for duplicate license plate
    const existing = await prisma.loanerVehicle.findFirst({
      where: {
        shopId,
        licensePlate: validated.licensePlate,
        status: { not: 'retired' },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'License plate already in use' },
        { status: 400 }
      );
    }

    // Create loaner vehicle
    const vehicle = await prisma.loanerVehicle.create({
      data: {
        ...validated,
        shopId,
      },
    });

    logger.info('Loaner vehicle created', {
      shopId,
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

    logger.error('Failed to create loaner vehicle', error);
    return NextResponse.json(
      { error: 'Failed to create loaner vehicle' },
      { status: 500 }
    );
  }
}
