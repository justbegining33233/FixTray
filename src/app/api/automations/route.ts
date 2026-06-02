import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  try {
    const rules = await prisma.automationRule.findMany({
      where: { shopId },
      include: {
        executions: { orderBy: { sentAt: 'desc' }, take: 5 },
        _count: { select: { executions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const normalized = rules.map((rule) => ({
      ...rule,
      isActive: rule.active,
    }));

    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Error fetching automations:', error);
    return NextResponse.json({ error: 'Failed to fetch automations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['shop', 'manager', 'admin', 'superadmin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  try {
    const body = await req.json();

    if (!body.name || !body.type || !body.trigger || !body.messageTemplate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const active = body.active ?? body.isActive ?? true;

    const rule = await prisma.automationRule.create({
      data: {
        shopId,
        name: body.name,
        type: body.type,
        trigger: body.trigger,
        triggerValue: Number(body.triggerValue) || 0,
        channel: body.channel || 'sms',
        messageTemplate: body.messageTemplate,
        active,
      },
    });

    return NextResponse.json({ ...rule, isActive: rule.active }, { status: 201 });
  } catch (error) {
    console.error('Error creating automation:', error);
    return NextResponse.json({ error: 'Failed to create automation' }, { status: 500 });
  }
}
