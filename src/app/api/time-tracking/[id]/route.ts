import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    const timeEntry = await prisma.timeEntry.findUnique({ where: { id } });
    if (!timeEntry) return NextResponse.json({ error: 'Time entry not found' }, { status: 404 });

    const updates: any = {};

    // Techs can update their own notes and link to a work order
    if (decoded.id === timeEntry.techId || decoded.role === 'manager' || (decoded.role === 'superadmin')) {
      if (body.notes !== undefined) updates.notes = body.notes;
      if (body.workOrderId !== undefined) updates.workOrderId = body.workOrderId || null;
      if (body.isPto !== undefined) updates.isPto = !!body.isPto;
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Manager / admin only: approve / lock / override hoursWorked
    if (body.approved !== undefined || body.locked !== undefined || body.approvedBy !== undefined || body.hoursWorked !== undefined) {
      if (decoded.role !== 'manager' && (decoded.role !== 'superadmin')) {
        return NextResponse.json({ error: 'Manager role required for approvals/locks' }, { status: 403 });
      }

      if (body.approved !== undefined) {
        updates.approved = !!body.approved;
        updates.approvedAt = body.approved ? new Date() : null;
        updates.approvedBy = body.approved ? decoded.id : null;
      }

      if (body.locked !== undefined) updates.locked = !!body.locked;
      if (body.hoursWorked !== undefined) updates.hoursWorked = parseFloat(body.hoursWorked) || null;
    }

    const updated = await prisma.timeEntry.update({ where: { id }, data: updates });
    return NextResponse.json({ success: true, timeEntry: updated });
  } catch (err) {
    console.error('Error updating time entry:', err);
    return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 });
  }
}
