/**
 * POST /api/cron/recurring-workorders
 * GET  /api/cron/recurring-workorders  (Vercel Cron calls GET)
 *
 * Processes active recurring schedules whose nextRunAt <= now.
 *
 * requiresApproval = true  (default): creates WO with status 'awaiting-confirmation'
 *                                     and notifies the customer. Bay is NOT reserved
 *                                     until customer confirms at /customer/recurring-approvals.
 * requiresApproval = false:           creates WO directly with status 'pending'.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendRecurringApprovalEmail } from '@/lib/emailService';
import logger from '@/lib/logger';
import { pushRecurringServiceDue } from '@/lib/serverPush';

function nextRunDate(frequency: string, from: Date = new Date()): Date {
  const d = new Date(from);
  switch (frequency) {
    case 'weekly':    d.setDate(d.getDate() + 7); break;
    case 'biweekly':  d.setDate(d.getDate() + 14); break;
    case 'monthly':   d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'annually':  d.setFullYear(d.getFullYear() + 1); break;
    default:          d.setMonth(d.getMonth() + 1);
  }
  return d;
}

export async function POST(request: NextRequest) {
  // Auth: accept either CRON_SECRET header or Vercel's built-in Authorization header
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-cron-secret');

  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${secret}` && cronHeader !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  try {
    // Find all active recurring schedules that are due
    const due = await prisma.recurringWorkOrder.findMany({
      where: {
        active: true,
        nextRunAt: { lte: now },
      },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
        shop: { select: { shopName: true } },
      },
    });

    if (due.length === 0) {
      return NextResponse.json({ success: true, created: 0, message: 'No schedules due' });
    }

    const created: string[] = [];

    for (const schedule of due) {
      try {
        // requiresApproval=true → status 'awaiting-confirmation', notify customer, bay NOT reserved
        // requiresApproval=false → status 'pending', goes straight to shop queue
        const woStatus = schedule.requiresApproval ? 'awaiting-confirmation' : 'pending';

        const workOrder = await prisma.workOrder.create({
          data: {
            customerId: schedule.customerId,
            shopId: schedule.shopId,
            vehicleId: schedule.vehicleId || null,
            vehicleType: schedule.vehicleType,
            serviceLocation: schedule.serviceLocation,
            issueDescription: `[Recurring] ${schedule.title} � ${schedule.issueDescription}`,
            estimatedCost: schedule.estimatedCost || null,
            status: woStatus,
            paymentStatus: 'unpaid',
          },
        });

        created.push(workOrder.id);

        if (schedule.requiresApproval) {
          const customerName = `${schedule.customer.firstName} ${schedule.customer.lastName}`;
          await sendRecurringApprovalEmail(
            schedule.customer.email,
            customerName,
            schedule.title,
            schedule.shop.shopName,
            schedule.estimatedCost
          ).catch(console.error);
          await pushRecurringServiceDue(schedule.customerId, schedule.title).catch(console.error);
        } else {
        }

        // Advance the schedule regardless
        await prisma.recurringWorkOrder.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: now,
            nextRunAt: nextRunDate(schedule.frequency, now),
          },
        });
      } catch (err) {
        console.error(`[Cron] Failed to create WO for schedule ${schedule.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      workOrderIds: created,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[Cron] Recurring work orders job failed', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Cron job failed', detail: msg }, { status: 500 });
  }
}

// Vercel Cron calls GET � run same processing logic
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-cron-secret');

  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${secret}` && cronHeader !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  try {
    const due = await prisma.recurringWorkOrder.findMany({
      where: { active: true, nextRunAt: { lte: now } },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
        shop: { select: { shopName: true } },
      },
    });

    if (due.length === 0) {
      return NextResponse.json({ success: true, created: 0, message: 'No schedules due' });
    }

    const created: string[] = [];

    for (const schedule of due) {
      try {
        const woStatus = schedule.requiresApproval ? 'awaiting-confirmation' : 'pending';

        const workOrder = await prisma.workOrder.create({
          data: {
            customerId: schedule.customerId,
            shopId: schedule.shopId,
            vehicleId: schedule.vehicleId || null,
            vehicleType: schedule.vehicleType,
            serviceLocation: schedule.serviceLocation,
            issueDescription: `[Recurring] ${schedule.title} � ${schedule.issueDescription}`,
            estimatedCost: schedule.estimatedCost || null,
            status: woStatus,
            paymentStatus: 'unpaid',
          },
        });

        created.push(workOrder.id);

        if (schedule.requiresApproval) {
          const customerName = `${schedule.customer.firstName} ${schedule.customer.lastName}`;
          await sendRecurringApprovalEmail(
            schedule.customer.email,
            customerName,
            schedule.title,
            schedule.shop.shopName,
            schedule.estimatedCost
          ).catch(console.error);
          await pushRecurringServiceDue(schedule.customerId, schedule.title).catch(console.error);
        }

        await prisma.recurringWorkOrder.update({
          where: { id: schedule.id },
          data: { lastRunAt: now, nextRunAt: nextRunDate(schedule.frequency, now) },
        });
      } catch (err) {
        console.error(`[Cron] Failed to create WO for schedule ${schedule.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, created: created.length, workOrderIds: created });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Cron] GET error:', msg);
    return NextResponse.json({ error: 'Cron job failed', detail: msg }, { status: 500 });
  }
}
