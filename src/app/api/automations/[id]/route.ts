import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['shop', 'manager', 'admin', 'superadmin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  const { id } = await params;
  try {
    const existing = await prisma.automationRule.findUnique({ where: { id }, select: { id: true, shopId: true } });
    if (!existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    if (existing.shopId !== shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    // Allowlist mutable fields — prevent shopId/id overwrite
    const { name, type, trigger, triggerValue, channel, messageTemplate } = body;
    const active = body.active ?? body.isActive;
    const rule = await prisma.automationRule.update({
      where: { id },
      data: { name, type, trigger, triggerValue, channel, messageTemplate, active },
    });
    return NextResponse.json({ ...rule, isActive: rule.active });
  } catch (error) {
    console.error('Error updating automation:', error);
    return NextResponse.json({ error: 'Failed to update automation' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['shop', 'manager', 'admin', 'superadmin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  const { id } = await params;
  try {
    const existing = await prisma.automationRule.findUnique({ where: { id }, select: { id: true, shopId: true } });
    if (!existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    if (existing.shopId !== shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await prisma.automationRule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting automation:', error);
    return NextResponse.json({ error: 'Failed to delete automation' }, { status: 500 });
  }
}
