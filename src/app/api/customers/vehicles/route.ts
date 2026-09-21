import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateRequest } from '@/lib/middleware';
import { normalizeVehicleType } from '@/lib/vehicleTypes';

// GET - Get customer vehicles
export async function GET(request: NextRequest) {
  try {
    const user = authenticateRequest(request);
    if (!user || user.role !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vehicles = await prisma.vehicle.findMany({
      where: { customerId: user.id },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Add vehicle
export async function POST(request: NextRequest) {
  try {
    const user = authenticateRequest(request);
    if (!user || user.role !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { make, model, year, vin, licensePlate, vehicleType } = body;

    if (!make || !model || !year) {
      return NextResponse.json(
        { error: 'Make, model, and year are required' },
        { status: 400 }
      );
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        customerId: user.id,
        vehicleType: normalizeVehicleType(vehicleType),
        make,
        model,
        year: parseInt(year),
        vin: vin || null,
        licensePlate: licensePlate || null,
        // mileage: mileage ? parseInt(mileage) : null,
      },
    });

    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (error) {
    console.error('Error creating vehicle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
