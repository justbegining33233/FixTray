import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const recurringReminderSchema = z.object({
  reminderType: z.enum(['vehicle-service', 'inspection-due', 'follow-up', 'maintenance']),
  vehicleId: z.string().min(1, 'Vehicle required'),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually']),
  notificationMethod: z.enum(['email', 'sms', 'in-app']).array(),
  message: z.string().min(1),
  daysBeforeDue: z.number().int().min(0).optional(),
  status: z.enum(['active', 'paused', 'completed']).optional(),
  nextReminderDate: z.string().datetime().optional(),
  shopId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const vehicleId = searchParams.get('vehicleId');
    const type = searchParams.get('type');

    const where: any = { shopId: auth.user?.shopId };
    if (status) where.status = status;
    if (vehicleId) where.vehicleId = vehicleId;
    if (type) where.reminderType = type;

    const reminders = await prisma.recurringReminder.findMany({
      where,
      include: {
        vehicle: true,
        shop: { select: { id: true, shopName: true } },
      },
      orderBy: { nextReminderDate: 'asc' },
    });

    logger.info('Retrieved recurring reminders', { count: reminders.length, shopId: auth.user?.shopId });
    return NextResponse.json(reminders);
  } catch (error) {
    logger.error('Error getting recurring reminders', { error });
    return NextResponse.json(
      { error: 'Failed to fetch reminders' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const validated = recurringReminderSchema.parse(body);

    // Verify vehicle exists
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: validated.vehicleId },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    // Calculate next reminder date
    const nextReminderDate = new Date();
    if (validated.daysBeforeDue) {
      nextReminderDate.setDate(nextReminderDate.getDate() + validated.daysBeforeDue);
    }

    // Create reminder
    const reminder = await prisma.recurringReminder.create({
      data: {
        reminderType: validated.reminderType,
        vehicleId: validated.vehicleId,
        frequency: validated.frequency,
        notificationMethod: validated.notificationMethod,
        message: validated.message,
        daysBeforeDue: validated.daysBeforeDue,
        status: 'active',
        nextReminderDate,
        shopId: auth.user?.shopId,
      },
      include: { vehicle: true },
    });

    logger.info('Recurring reminder created', {
      reminderId: reminder.id,
      type: reminder.reminderType,
      vehicleId: reminder.vehicleId,
    });

    return NextResponse.json(reminder, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error creating recurring reminder', { error });
    return NextResponse.json(
      { error: 'Failed to create reminder' },
      { status: 500 }
    );
  }
}
