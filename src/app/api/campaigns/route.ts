import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { z } from 'zod';
import logger from '@/lib/logger';

const campaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().positive(),
  active: z.boolean().default(true),
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

    const body = await request.json();
    const validated = campaignSchema.parse(body);

    const campaign = await prisma.campaign.create({
      data: { ...validated, shopId },
    });

    logger.info('Campaign created', { shopId, campaignId: campaign.id });
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    logger.error('Error creating campaign', { error });
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}
