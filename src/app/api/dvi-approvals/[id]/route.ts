import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { dviApprovalStatus, notesWithoutNextDue, readNextInspectionDue, vehicleLabel, writeInspectionNotes } from '@/lib/dviApproval';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, ['admin', 'shop', 'manager']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const approvalStatus = String(body.approvalStatus || '');
    if (approvalStatus !== 'approved' && approvalStatus !== 'rejected') {
      return NextResponse.json({ error: 'approvalStatus must be approved or rejected' }, { status: 400 });
    }

    const existing = await prisma.dVIInspection.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
    if (auth.role === 'shop' && existing.shopId !== auth.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (auth.role === 'manager' && auth.shopId && existing.shopId !== auth.shopId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const nextDue = approvalStatus === 'approved' && body.nextInspectionDue
      ? String(body.nextInspectionDue)
      : null;
    const updated = await prisma.dVIInspection.update({
      where: { id },
      data: {
        customerApproved: approvalStatus === 'approved',
        approvedAt: approvalStatus === 'approved' ? new Date() : existing.approvedAt,
        status: approvalStatus,
        notes: writeInspectionNotes({
          existing: existing.notes,
          rejectionNote: approvalStatus === 'rejected' ? body.notes : null,
          nextInspectionDue: nextDue,
        }),
      },
    });

    const vehicle = vehicleLabel(updated.vehicleDesc);
    return NextResponse.json({
      id: updated.id,
      inspectionId: updated.id,
      vehicleId: updated.workOrderId || '',
      vehicle,
      approvalStatus: dviApprovalStatus(updated),
      notes: notesWithoutNextDue(updated.notes),
      inspectionDate: updated.createdAt.toISOString(),
      nextInspectionDue: readNextInspectionDue(updated.notes),
      approvedAt: updated.approvedAt ? updated.approvedAt.toISOString() : null,
    });
  } catch (error) {
    console.error('DVI approval update error:', error);
    return NextResponse.json({ error: 'Failed to update DVI approval' }, { status: 500 });
  }
}
