import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });

  const { id } = await params;
  try {
    const body = await req.json();
    // Ensure the rule belongs to this shop
    const existing = await prisma.taxRule.findFirst({ where: { id, shopId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = await prisma.taxRule.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        rate: body.rate !== undefined ? Number(body.rate) : existing.rate,
        appliesToLabor: body.appliesToLabor !== undefined ? Boolean(body.appliesToLabor) : existing.appliesToLabor,
        appliesToParts: body.appliesToParts !== undefined ? Boolean(body.appliesToParts) : existing.appliesToParts,
        appliesToFees: body.appliesToFees !== undefined ? Boolean(body.appliesToFees) : existing.appliesToFees,
        exemptServices: body.exemptServices ?? existing.exemptServices,
        state: body.state !== undefined ? (body.state ? String(body.state).trim() : null) : existing.state,
        county: body.county !== undefined ? (body.county ? String(body.county).trim() : null) : existing.county,
        active: body.active !== undefined ? Boolean(body.active) : existing.active,
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PUT /api/tax-rules/[id]', err);
    return NextResponse.json({ error: 'Failed to update tax rule' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });

  const { id } = await params;
  try {
    const existing = await prisma.taxRule.findFirst({ where: { id, shopId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.taxRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/tax-rules/[id]', err);
    return NextResponse.json({ error: 'Failed to delete tax rule' }, { status: 500 });
  }
}
