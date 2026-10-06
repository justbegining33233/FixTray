import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { shopJobReceiptCents } from '@/lib/books/money';
import { dayKey } from '@/lib/books/periods';
import { shopDayRange } from '@/lib/books/periods';
import { loadShopFacts, shopTimeZone } from '@/lib/books/loadTruth';
import { positionJobs, rangeSnapshot } from '@/lib/books/truth';

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!['shop', 'manager', 'admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
  if (!shopId) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const zone = await shopTimeZone(shopId);
    const targetKey = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : dayKey(new Date(), zone);
    const day = shopDayRange(targetKey, zone);
    const startOfDay = day.start;
    const endOfDay = day.end;
    const facts = await loadShopFacts(shopId);
    const snap = rangeSnapshot(facts, startOfDay, endOfDay, zone);
    const showRevenue = auth.role === 'shop' || auth.role === 'admin';

    // Jobs completed today
    const completedJobs = await prisma.workOrder.findMany({
      where: {
        shopId,
        completedAt: { gte: startOfDay, lt: endOfDay },
      },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
      orderBy: { completedAt: 'desc' },
    });

    // Jobs created today
    const newJobs = await prisma.workOrder.count({
      where: {
        shopId,
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
    });

    // Jobs still open
    const openJobs = await prisma.workOrder.count({
      where: {
        shopId,
        status: { notIn: ['closed', 'completed', 'denied-estimate'] },
      },
    });

    // Payment breakdown from work orders paid today
    const totalRevenue = snap.revenueCents / 100;
    const paymentBreakdown = {
      cash: snap.cashCents / 100,
      card: snap.cardCents / 100,
      check: snap.checkCents / 100,
      transfer: snap.transferCents / 100,
      other: snap.otherCents / 100,
      total: totalRevenue,
    };

    const arRows = positionJobs(facts).filter((job) => job.arCents > 0);
    const outstandingWOs = arRows.length === 0 ? [] : await prisma.workOrder.findMany({
      where: { shopId, id: { in: arRows.map((job) => job.workOrderId) } },
      select: {
        id: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    });
    const arById = new Map(arRows.map((job) => [job.workOrderId, job.arCents]));
    const outstandingBalance = arRows.reduce((sum, job) => sum + job.arCents, 0) / 100;

    // Tech hours (time entries)
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        shopId,
        clockIn: { gte: startOfDay, lt: endOfDay },
      },
      include: {
        tech: { select: { firstName: true, lastName: true } },
      },
    });

    const techHours = timeEntries.map(entry => {
      const clockOut = entry.clockOut || new Date();
      const hours = (clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60);
      return {
        techName: `${entry.tech.firstName} ${entry.tech.lastName}`,
        hours: Math.round(hours * 100) / 100,
        clockIn: entry.clockIn,
        clockOut: entry.clockOut,
      };
    });

    // Appointments today
    const appointments = await prisma.appointment.count({
      where: {
        shopId,
        scheduledDate: { gte: startOfDay, lt: endOfDay },
      },
    });

    const completed = completedJobs.map((job) => ({
      id: job.id,
      customer: job.customer ? `${job.customer.firstName} ${job.customer.lastName}` : 'N/A',
      tech: job.assignedTo ? `${job.assignedTo.firstName} ${job.assignedTo.lastName}` : 'Unassigned',
      vehicleType: job.vehicleType,
      completedAt: job.completedAt,
      ...(showRevenue ? {
        amount: job.paymentStatus === 'paid'
          ? shopJobReceiptCents(job) / 100
          : (job.estimatedCost || 0),
      } : {}),
    }));

    if (!showRevenue) {
      return NextResponse.json({
        date: targetKey,
        revenueVisible: false,
        summary: {
          completedJobsCount: completedJobs.length,
          newJobsCount: newJobs,
          openJobsCount: openJobs,
          appointmentsCount: appointments,
        },
        completedJobs: completed,
        techHours,
      });
    }

    return NextResponse.json({
      date: targetKey,
      timeZone: zone,
      revenueVisible: true,
      summary: {
        completedJobsCount: completedJobs.length,
        newJobsCount: newJobs,
        openJobsCount: openJobs,
        appointmentsCount: appointments,
        outstandingBalance: Math.round(outstandingBalance * 100) / 100,
      },
      paymentBreakdown,
      completedJobs: completed,
      outstandingWOs: outstandingWOs.map(wo => ({
        id: wo.id,
        customer: wo.customer ? `${wo.customer.firstName} ${wo.customer.lastName}` : 'N/A',
        owed: (arById.get(wo.id) || 0) / 100,
      })),
      techHours,
    });
  } catch (error) {
    console.error('Error generating EOD report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
