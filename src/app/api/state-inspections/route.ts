import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { calendarDateToUtcNoon } from '@/lib/calendarDate';
import { validateInspectionRecord } from '@/lib/shopFormValidation';

function shopIdFromAuth(auth: { id: string; role: string; shopId?: string }) {
  return auth.role === 'shop' ? auth.id : auth.shopId;
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireRole(request, ['shop', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const shopId = shopIdFromAuth(auth);
    if (!shopId) return NextResponse.json([]);

    const inspections = await prisma.stateInspection.findMany({
      where: { shopId },
      orderBy: { inspectedAt: 'desc' },
    });

    return NextResponse.json(inspections.map((row) => ({
      ...row,
      stickerId: row.stickerNumber,
      expiryDate: row.expiresAt,
      result: row.result,
    })));
  } catch (error) {
    logger.error('Failed to fetch state inspections', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch state inspections' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['shop', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const shopId = shopIdFromAuth(auth);
    if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const check = validateInspectionRecord(body);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const expiry = body.expiryDate ? calendarDateToUtcNoon(body.expiryDate) : null;
    const feeNote = body.fee ? `Fee charged: $${Number(body.fee)}` : '';
    const odometerNote = body.odometer ? `Odometer: ${body.odometer}` : '';
    const notes = [body.notes, feeNote, odometerNote].filter(Boolean).join('\n') || null;

    const defaultExpiry = new Date();
    defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);

    const inspection = await prisma.stateInspection.create({
      data: {
        shopId,
        workOrderId: body.workOrderId ? String(body.workOrderId).trim() : null,
        customerId: body.customerId ? String(body.customerId) : null,
        vehicleDesc: body.vehicleDesc ? String(body.vehicleDesc).trim() : null,
        vin: body.vin ? String(body.vin).trim() : null,
        licensePlate: body.licensePlate ? String(body.licensePlate).trim() : null,
        inspectionType: String(body.inspectionType).trim(),
        result: String(body.result).trim(),
        stickerNumber: body.stickerId || body.stickerNumber ? String(body.stickerId || body.stickerNumber).trim() : null,
        inspectorId: auth.role === 'manager' ? auth.id : (body.inspectorId ? String(body.inspectorId) : null),
        notes,
        expiresAt: expiry || (String(body.result) === 'pass' ? defaultExpiry : null),
      },
    });

    return NextResponse.json({ ...inspection, stickerId: inspection.stickerNumber, expiryDate: inspection.expiresAt }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create state inspection', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to create state inspection' }, { status: 500 });
  }
}
