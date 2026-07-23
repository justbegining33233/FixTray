import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { z } from 'zod';
import logger from '@/lib/logger';

const campaignUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  discountType: z.enum(['percentage', 'fixed']).optional(),
  discountValue: z.number().positive().optional(),
  active: z.boolean().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const user = auth;

    const { id } = await params;
    const campaign = await prisma.campaign.findFirst({
      where: { id, shopId: user.shopId },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    logger.error('Error getting campaign', { error });
    return NextResponse.json({ error: 'Failed to get campaign' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(request, ['shop_owner', 'admin']);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const user = auth;

    const { id } = await params;
    const body = await request.json();
    const validated = campaignUpdateSchema.parse(body);

    const campaign = await prisma.campaign.updateMany({
      where: { id, shopId: user.shopId },
      data: validated,
    });

    if (campaign.count === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    logger.info('Campaign updated', { campaignId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }
    logger.error('Error updating campaign', { error });
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(request, ['shop_owner', 'admin']);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const user = auth;

    const { id } = await params;
    const campaign = await prisma.campaign.deleteMany({
      where: { id, shopId: user.shopId },
    });

    if (campaign.count === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    logger.info('Campaign deleted', { campaignId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting campaign', { error });
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }
}
