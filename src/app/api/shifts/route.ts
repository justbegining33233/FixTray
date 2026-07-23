import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const shiftSchema = z.object({
  techId: z.string().min(1, 'Tech required'),
  date: z.string().datetime(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
  shiftType: z.enum(['regular', 'overtime', 'graveyard']).default('regular'),
  position: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled']).default('scheduled'),
});

export async function GET(request: NextRequest) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const techId = searchParams.get('techId');

    if (!shopId) {
      return NextResponse.json(
        { error: 'shopId required' },
        { status: 400 }
      );
    }

    const where: any = { shopId };
    if (startDate) where.date = { gte: new Date(startDate) };
    if (endDate) where.date = { ...where.date, lte: new Date(endDate) };
    if (techId) where.techId = techId;

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        tech: { select: { id: true, firstName: true, lastName: true, email: true } },
        swapRequests: { select: { id: true, status: true } },
      },
      orderBy: { date: 'asc' },
    });

    logger.debug('Shifts retrieved', { shopId, count: shifts.length });

    return NextResponse.json(shifts);
  } catch (error) {
    logger.error('Failed to fetch shifts', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch shifts' },
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
    const validated = shiftSchema.parse(body);

    // Check for overlapping shifts
    const date = new Date(validated.date);
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dateEnd = new Date(dateStart);
    dateEnd.setDate(dateEnd.getDate() + 1);

    const existing = await prisma.shift.findFirst({
      where: {
        shopId,
        techId: validated.techId,
        date: {
          gte: dateStart,
          lt: dateEnd,
        },
        status: { not: 'cancelled' },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Tech already has a shift scheduled for this date' },
        { status: 400 }
      );
    }

    // Create shift
    const shift = await prisma.shift.create({
      data: {
        ...validated,
        date: new Date(validated.date),
        shopId,
      },
      include: {
        tech: true,
        swapRequests: true,
      },
    });

    logger.info('Shift created', {
      shopId,
      shiftId: shift.id,
      techId: shift.techId,
      date: shift.date,
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Failed to create shift', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to create shift' },
      { status: 500 }
    );
  }
}
