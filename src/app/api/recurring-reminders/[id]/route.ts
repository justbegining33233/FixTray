import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const updateReminderSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually']).optional(),
  notificationMethod: z.enum(['email', 'sms', 'in-app']).array().optional(),
  message: z.string().min(1).optional(),
  daysBeforeDue: z.number().int().min(0).optional(),
  status: z.enum(['active', 'paused', 'completed']).optional(),
  nextReminderDate: z.string().datetime().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const reminder = await prisma.recurringReminder.findUnique({
      where: { id },
      include: {
        vehicle: true,
        shop: { select: { id: true, shopName: true } },
      },
    });

    if (!reminder) {
      return NextResponse.json(
        { error: 'Reminder not found' },
        { status: 404 }
      );
    }

    logger.debug('Reminder retrieved', { id });
    return NextResponse.json(reminder);
  } catch (error) {
    logger.error('Error fetching reminder', { error });
    return NextResponse.json(
      { error: 'Failed to fetch reminder' },
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
    const validated = updateReminderSchema.parse(body);

    // Verify reminder exists
    const existing = await prisma.recurringReminder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Reminder not found' },
        { status: 404 }
      );
    }

    // Update reminder
    const updated = await prisma.recurringReminder.update({
      where: { id },
      data: validated,
      include: { vehicle: true },
    });

    logger.info('Reminder updated', { id });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error updating reminder', { error });
    return NextResponse.json(
      { error: 'Failed to update reminder' },
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

    // Verify reminder exists
    const existing = await prisma.recurringReminder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Reminder not found' },
        { status: 404 }
      );
    }

    // Delete reminder
    await prisma.recurringReminder.delete({ where: { id } });

    logger.info('Reminder deleted', { id });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting reminder', { error });
    return NextResponse.json(
      { error: 'Failed to delete reminder' },
      { status: 500 }
    );
  }
}
