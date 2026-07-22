import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const stateInspectionSchema = z.object({
  workOrderId: z.string().optional(),
  customerId: z.string().optional(),
  vehicleDesc: z.string().optional(),
  vin: z.string(),
  licensePlate: z.string(),
  inspectionType: z.enum(['state', 'emissions', 'safety']).default('state'),
  result: z.enum(['pass', 'fail', 'conditional']),
  stickerNumber: z.string().optional(),
  inspectorId: z.string().optional(),
  failReason: z.string().optional(),
  notes: z.string().optional(),
  reportUrl: z.string().url().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const status = searchParams.get('status');
    const vin = searchParams.get('vin');

    if (!shopId) {
      return NextResponse.json(
        { error: 'shopId required' },
        { status: 400 }
      );
    }

    const where: any = { shopId };
    if (vin) where.vin = vin;
    if (status) where.result = status;

    const inspections = await prisma.stateInspection.findMany({
      where,
      orderBy: { inspectedAt: 'desc' },
    });

    logger.debug('State inspections retrieved', { shopId, count: inspections.length });

    return NextResponse.json(inspections);
  } catch (error) {
    logger.error('Failed to fetch state inspections', error);
    return NextResponse.json(
      { error: 'Failed to fetch state inspections' },
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
    const validated = stateInspectionSchema.parse(body);

    // Calculate expiration (1 year from inspection)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Create inspection
    const inspection = await prisma.stateInspection.create({
      data: {
        ...validated,
        shopId,
        expiresAt: validated.result === 'pass' ? expiresAt : null,
      },
    });

    logger.info('State inspection created', {
      shopId,
      inspectionId: inspection.id,
      vin: validated.vin,
      result: validated.result,
    });

    return NextResponse.json(inspection, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Failed to create state inspection', error);
    return NextResponse.json(
      { error: 'Failed to create state inspection' },
      { status: 500 }
    );
  }
}
