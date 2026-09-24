import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { canonicalWorkOrderAlertId, storedWorkOrderId } from '@/lib/notificationInbox';

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_IDS = 50;

function shopFor(auth: { id: string; role: string; shopId?: string | null }): string | null {
  if (auth.role === 'shop') return auth.id;
  return auth.shopId || null;
}

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const cutoff = new Date(Date.now() - RETENTION_MS);
  await prisma.seenWorkOrderAlert.deleteMany({
    where: { userId: auth.id, seenAt: { lt: cutoff } },
  });

  const rows = await prisma.seenWorkOrderAlert.findMany({
    where: { userId: auth.id, seenAt: { gte: cutoff } },
    orderBy: { seenAt: 'desc' },
    take: 200,
    select: { workOrderId: true },
  });

  return NextResponse.json({
    ids: rows
      .map((row) => canonicalWorkOrderAlertId(row.workOrderId))
      .filter((id): id is string => Boolean(id)),
  });
}

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const incoming = Array.isArray(body?.ids) ? body.ids : [];
  const workOrderIds = Array.from(new Set(
    incoming
      .filter((id: unknown): id is string => typeof id === 'string')
      .map((id: string) => storedWorkOrderId(id))
      .filter((id: string | null): id is string => Boolean(id)),
  )).slice(0, MAX_IDS);

  if (workOrderIds.length === 0) {
    return NextResponse.json({ success: true, saved: 0 });
  }

  await prisma.seenWorkOrderAlert.createMany({
    data: workOrderIds.map((workOrderId) => ({
      userId: auth.id,
      userRole: auth.role,
      shopId: shopFor(auth),
      workOrderId,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ success: true, saved: workOrderIds.length });
}
