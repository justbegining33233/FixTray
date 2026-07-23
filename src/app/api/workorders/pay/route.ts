import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import logger from '@/lib/logger';
import { validateCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  // Only shops/managers/admins can mark a work order as paid
  if (!['shop', 'manager', 'admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let workOrderId: string | undefined;
  try {
    if (!req.headers.get('authorization')) {
      const ok = await validateCsrf(req);
      if (!ok) return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
    }
    const { workOrderId: woid } = await req.json();
    workOrderId = woid;
    const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
    
    if (!wo) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }
    
    if (wo.status !== 'waiting-for-payment') {
      return NextResponse.json({ error: 'Work order must be waiting-for-payment' }, { status: 400 });
    }
    
    const updated = await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { status: 'closed' },
    });
    return NextResponse.json(updated);
  } catch (e) {
    logger.error('Failed to mark work order as paid', {
      error: e instanceof Error ? e.message : String(e),
      workOrderId: workOrderId
    });
    return NextResponse.json({ error: 'Failed to mark as paid' }, { status: 500 });
  }
}
