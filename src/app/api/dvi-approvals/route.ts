import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { dviApprovalStatus, notesWithoutNextDue, readNextInspectionDue, vehicleLabel } from '@/lib/dviApproval';

function toApproval(row: {
  id: string;
  workOrderId: string | null;
  vehicleDesc: string | null;
  notes: string | null;
  status: string;
  customerApproved: boolean;
  approvedAt: Date | null;
  createdAt: Date;
}) {
  const vehicle = vehicleLabel(row.vehicleDesc);
  return {
    id: row.id,
    inspectionId: row.id,
    vehicleId: row.workOrderId || '',
    vehicle,
    approvalStatus: dviApprovalStatus(row),
    notes: notesWithoutNextDue(row.notes),
    inspectionDate: row.createdAt.toISOString(),
    nextInspectionDue: readNextInspectionDue(row.notes),
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
  };
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'shop', 'manager']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const pending = searchParams.get('pending') === 'true';
    const status = searchParams.get('status');
    const shopId = auth.role === 'shop' ? auth.id : auth.role === 'manager' ? auth.shopId : undefined;

    const rows = await prisma.dVIInspection.findMany({
      where: shopId ? { shopId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const approvals = rows.map(toApproval).filter((row) => {
      if (pending || status === 'pending') return row.approvalStatus === 'pending';
      if (status === 'approved' || status === 'rejected') return row.approvalStatus === status;
      return true;
    });

    return NextResponse.json(approvals);
  } catch (error) {
    console.error('DVI approvals list error:', error);
    return NextResponse.json({ error: 'Failed to load DVI approvals' }, { status: 500 });
  }
}
