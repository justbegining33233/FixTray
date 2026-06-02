import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const shopId = auth.role === 'shop' ? auth.id : (auth as unknown as Record<string, unknown>).shopId as string | undefined;
  if (!shopId) return NextResponse.json({ inspections: [] });

  try {
    const [dviInspections, stateInspections] = await Promise.all([
      prisma.dVIInspection.findMany({
        where: { shopId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.stateInspection.findMany({
        where: { shopId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const inspections = [
      ...dviInspections.map(d => ({
        id: d.id,
        vehicleInfo: d.vehicleDesc || 'Unknown Vehicle',
        status: d.status === 'approved' ? 'passed' : d.status === 'declined' ? 'failed' : 'pending',
        date: d.createdAt.toISOString(),
        inspector: d.techId || 'Unassigned',
        notes: d.notes || undefined,
        type: 'dvi' as const,
      })),
      ...stateInspections.map(s => ({
        id: s.id,
        vehicleInfo: s.vehicleDesc || s.vin || 'Unknown Vehicle',
        status: s.result === 'pass' ? 'passed' : s.result === 'fail' ? 'failed' : 'pending',
        date: (s.inspectedAt || s.createdAt).toISOString(),
        inspector: s.inspectorId || 'Unassigned',
        notes: s.notes || undefined,
        type: 'state' as const,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ inspections });
  } catch (error) {
    console.error('[api/inspections] Error:', error);
    return NextResponse.json({ inspections: [] });
  }
}
