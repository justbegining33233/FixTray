import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { customerJobTrack } from '@/lib/customerJobTrack';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'customer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const workOrder = await prisma.workOrder.findFirst({
    where: { id, customerId: payload.id },
    include: {
      vehicle: { select: { year: true, make: true, model: true, licensePlate: true } },
      shop: { select: { shopName: true } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!workOrder) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  return NextResponse.json(customerJobTrack(workOrder));
}
