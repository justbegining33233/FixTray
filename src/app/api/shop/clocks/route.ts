import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { booksAccess, shopIdForBooks } from '@/lib/books/access';
import { correctClock, minutesFromHours, staffPunchMinutes, sumStaffMinutes, sumWorkMinutes } from '@/lib/books/clocks';
import { writeAudit } from '@/lib/books/persist';
import { ensureProductionColumns } from '@/lib/ensureProductionColumns';
import { payableHours } from '@/lib/timesheetPeriod';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'tech']);
  if (auth instanceof NextResponse) return auth;
  const access = booksAccess(auth.role);
  if (!access.ownClock) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const selfOnly = !access.staffTotals;
  const staffWhere = { shopId, ...(selfOnly ? { techId: auth.id } : {}) };
  const [staffEntries, workEntries] = await Promise.all([
    prisma.timeEntry.findMany({
      where: staffWhere,
      include: { tech: { select: { id: true, firstName: true, lastName: true, role: true } } },
      orderBy: { clockIn: 'asc' },
    }),
    prisma.workOrderTimeEntry.findMany({
      where: { shopId, ...(selfOnly ? { techId: auth.id } : {}) },
      orderBy: { clockIn: 'asc' },
    }),
  ]);

  const byPerson = new Map<string, typeof staffEntries>();
  for (const entry of staffEntries) {
    const list = byPerson.get(entry.techId) || [];
    list.push(entry);
    byPerson.set(entry.techId, list);
  }
  const people = [...byPerson.entries()].map(([personId, entries]) => {
    const tech = entries[0]?.tech;
    const hours = payableHours(entries, { clockedIn: entries.some((entry) => !entry.clockOut) });
    return {
      personId,
      name: tech ? `${tech.firstName} ${tech.lastName}`.trim() : personId,
      role: tech?.role || 'tech',
      minutes: minutesFromHours(hours),
    };
  });
  const staff = sumStaffMinutes(people);
  const now = new Date();
  const staffRows = staffEntries.map((entry) => {
    const tech = entry.tech;
    return {
      id: entry.id,
      personId: entry.techId,
      name: tech ? `${tech.firstName} ${tech.lastName}`.trim() : entry.techId,
      clockIn: entry.clockIn,
      minutes: staffPunchMinutes(entry, now),
    };
  });
  const work = workEntries.map((entry) => ({
    id: entry.id,
    personId: entry.techId,
    workOrderId: entry.workOrderId,
    minutes: entry.hoursSpent != null ? minutesFromHours(entry.hoursSpent) : 0,
  }));

  return NextResponse.json({
    scope: selfOnly ? 'self' : 'shop',
    people: staff.byPerson.map((person) => {
      const named = people.find((row) => row.personId === person.personId);
      return { ...person, name: named?.name || person.personId, role: named?.role || 'tech' };
    }),
    totalMinutes: staff.totalMinutes,
    totalHoursLabel: staff.totalHoursLabel,
    shopTotalMinutes: selfOnly ? null : staff.totalMinutes,
    workMinutes: sumWorkMinutes(work),
    work,
    staffEntries: staffRows,
  });
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'tech']);
  if (auth instanceof NextResponse) return auth;
  if (!booksAccess(auth.role).ownClock) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const clock = body && (body as { clock?: string }).clock === 'work' ? 'work' : 'staff';
  const entryId = body && typeof (body as { entryId?: string }).entryId === 'string' ? (body as { entryId: string }).entryId : '';
  const reason = body && typeof (body as { reason?: string }).reason === 'string' ? (body as { reason: string }).reason : '';
  const nextMinutes = body ? Number((body as { minutes?: number }).minutes) : NaN;
  if (!entryId) return NextResponse.json({ error: 'Clock entry is required' }, { status: 400 });

  await ensureProductionColumns();
  const selfOnly = !booksAccess(auth.role).staffTotals;
  if (clock === 'staff') {
    const entry = await prisma.timeEntry.findFirst({ where: { id: entryId, shopId } });
    if (!entry) return NextResponse.json({ error: 'Clock entry not found' }, { status: 404 });
    if (selfOnly && entry.techId !== auth.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const before = entry.hoursWorked != null
      ? minutesFromHours(entry.hoursWorked)
      : minutesFromHours(payableHours([entry], { clockedIn: !entry.clockOut }));
    const corrected = correctClock({
      clock: 'staff',
      entryId,
      nextMinutes,
      reason,
      actorId: auth.id,
      at: new Date().toISOString(),
      shopId,
      staff: [{ id: entry.id, personId: entry.techId, minutes: before }],
      work: [],
    });
    if (!corrected.ok) return NextResponse.json({ error: corrected.error }, { status: 400 });
    await prisma.timeEntry.update({
      where: { id: entry.id },
      data: { hoursWorked: corrected.staff[0].minutes / 60 },
    });
    await prisma.clockCorrection.create({
      data: {
        shopId,
        personId: entry.techId,
        clock: 'staff',
        entryId: entry.id,
        reason: reason.trim(),
        beforeMinutes: before,
        afterMinutes: corrected.staff[0].minutes,
        actorId: auth.id,
      },
    });
    await writeAudit(corrected.audit);
    return NextResponse.json({ ok: true, minutes: corrected.staff[0].minutes, audit: corrected.audit });
  }

  const entry = await prisma.workOrderTimeEntry.findFirst({ where: { id: entryId, shopId } });
  if (!entry) return NextResponse.json({ error: 'Clock entry not found' }, { status: 404 });
  if (selfOnly && entry.techId !== auth.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const before = entry.hoursSpent != null ? minutesFromHours(entry.hoursSpent) : 0;
  const corrected = correctClock({
    clock: 'work',
    entryId,
    nextMinutes,
    reason,
    actorId: auth.id,
    at: new Date().toISOString(),
    shopId,
    staff: [],
    work: [{ id: entry.id, personId: entry.techId, minutes: before }],
  });
  if (!corrected.ok) return NextResponse.json({ error: corrected.error }, { status: 400 });
  await prisma.workOrderTimeEntry.update({
    where: { id: entry.id },
    data: { hoursSpent: corrected.work[0].minutes / 60 },
  });
  await prisma.clockCorrection.create({
    data: {
      shopId,
      personId: entry.techId,
      clock: 'work',
      entryId: entry.id,
      reason: reason.trim(),
      beforeMinutes: before,
      afterMinutes: corrected.work[0].minutes,
      actorId: auth.id,
    },
  });
  await writeAudit(corrected.audit);
  return NextResponse.json({ ok: true, minutes: corrected.work[0].minutes, audit: corrected.audit });
}
