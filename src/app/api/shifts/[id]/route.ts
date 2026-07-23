import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const shiftUpdateSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  shiftType: z.enum(['regular', 'overtime', 'graveyard']).optional(),
  position: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled']).optional(),
  actualClockIn: z.string().datetime().optional(),
  actualClockOut: z.string().datetime().optional(),
  lateMinutes: z.number().int().min(0).optional(),
  earlyDepartureMins: z.number().int().min(0).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin', 'tech']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        tech: { select: { id: true, firstName: true, lastName: true, email: true } },
        shop: { select: { id: true, shopName: true } },
        swapRequests: { include: { requester: true, target: true } },
      },
    });

    if (!shift) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      );
    }

    logger.debug('Shift retrieved', { id });

    return NextResponse.json(shift);
  } catch (error) {
    logger.error('Failed to fetch shift', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch shift' },
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

    // Validate input
    const validated = shiftUpdateSchema.parse(body);

    // Verify shift exists
    const existing = await prisma.shift.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      );
    }

    // Update shift
    const updated = await prisma.shift.update({
      where: { id },
      data: {
        ...validated,
        actualClockIn: validated.actualClockIn ? new Date(validated.actualClockIn) : undefined,
        actualClockOut: validated.actualClockOut ? new Date(validated.actualClockOut) : undefined,
      },
      include: {
        tech: true,
        swapRequests: true,
      },
    });

    logger.info('Shift updated', { id, status: validated.status });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Failed to update shift', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to update shift' },
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

    // Verify shift exists
    const existing = await prisma.shift.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      );
    }

    // Delete shift and related swap requests (cascade)
    await prisma.shift.delete({ where: { id } });

    logger.info('Shift deleted', { id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete shift', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to delete shift' },
      { status: 500 }
    );
  }
}
