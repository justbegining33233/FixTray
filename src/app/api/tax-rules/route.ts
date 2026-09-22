import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import { ensureProductionColumns } from '@/lib/ensureProductionColumns';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  try {
    await ensureProductionColumns();
    const rules = await prisma.taxRule.findMany({ where: { shopId } });
    return NextResponse.json(rules);
  } catch (error) {
    console.error('[tax-rules GET]', error);
    return NextResponse.json({ error: 'Failed to load tax rules' }, { status: 500 });
  }
}
export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  await ensureProductionColumns();
  const body = await req.json();
  const rule = await prisma.taxRule.create({
    data: {
      shopId, name: body.name, rate: Number(body.rate) || 0,
      appliesToLabor: Boolean(body.appliesToLabor), appliesToParts: body.appliesToParts !== false,
      appliesToFees: Boolean(body.appliesToFees), exemptServices: body.exemptServices || null, active: body.active !== false,
      state: body.state ? String(body.state).trim() : null,
      county: body.county ? String(body.county).trim() : null,
    },
  });
  return NextResponse.json(rule, { status: 201 });
}
