import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { z } from 'zod';
import logger from '@/lib/logger';

const campaignSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  body: z.string().min(1),
  subject: z.string().optional(),
  status: z.string().default('draft'),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const user = auth;
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId') || user.shopId;

    if (!shopId) {
      return NextResponse.json({ error: 'shopId is required' }, { status: 400 });
    }

    const campaigns = await prisma.campaign.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
    });

    logger.info('Retrieved campaigns', { shopId, count: campaigns.length });
    return NextResponse.json(campaigns);
  } catch (error) {
    logger.error('Error getting campaigns', { error });
    return NextResponse.json({ error: 'Failed to get campaigns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['shop_owner', 'admin']);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const user = auth;
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId') || user.shopId;

    if (!shopId) {
      return NextResponse.json({ error: 'shopId is required' }, { status: 400 });
    }

    const body = await request.json();
    const validated = campaignSchema.parse(body);

    const campaign = await prisma.campaign.create({
      data: {
        shopId,
        name: validated.name,
        type: validated.type,
        body: validated.body,
        subject: validated.subject,
        status: validated.status,
      },
    });

    logger.info('Campaign created', { shopId, campaignId: campaign.id });
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    logger.error('Error creating campaign', { error });
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}
