import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { sendEmail } from '@/lib/emailService';
import { sendSms } from '@/lib/smsService';

async function deliverCampaign(campaign: {
  id: string;
  type: string;
  subject: string | null;
  body: string;
  shopId: string;
}, shopName: string) {
  const customerIds = await prisma.workOrder.findMany({
    where: { shopId: campaign.shopId },
    select: { customerId: true },
    distinct: ['customerId'],
  });

  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds.map((c) => c.customerId) } },
    select: { id: true, email: true, phone: true, firstName: true },
  });

  let sentCount = 0;
  let failedCount = 0;

  for (const customer of customers) {
    try {
      if ((campaign.type === 'email' || campaign.type === 'both') && customer.email) {
        const sent = await sendEmail({
          to: customer.email,
          subject: campaign.subject || `${shopName} Update`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e5332a;">${shopName}</h2>
              <div>${campaign.body}</div>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;"/>
              <p style="color: #888; font-size: 12px;">You received this because you're a customer of ${shopName}.</p>
            </div>
          `,
        });
        if (sent) sentCount++;
        else failedCount++;
      }

      if ((campaign.type === 'sms' || campaign.type === 'both') && customer.phone) {
        const plainText = campaign.body.replace(/<[^>]*>/g, '').substring(0, 160);
        const sent = await sendSms(customer.phone, `${shopName}: ${plainText}`);
        if (sent) sentCount++;
        else failedCount++;
      }
    } catch {
      failedCount++;
    }
  }

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status: 'sent',
      sentCount,
      failedCount,
      sentAt: new Date(),
    },
  });

  return updated;
}

// GET /api/shop/campaigns — List campaigns
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!['shop', 'manager', 'admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const shopId = auth.role === 'shop' ? auth.id : auth.shopId;

  try {
    const campaigns = await prisma.campaign.findMany({
      where: { shopId: shopId! },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

// POST /api/shop/campaigns — Create and optionally send a campaign
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!['shop', 'manager', 'admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
  if (!shopId) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { name, type, subject, messageBody, sendNow, campaignId } = body;

    // Send an existing draft campaign
    if (campaignId && sendNow) {
      const existing = await prisma.campaign.findFirst({
        where: { id: campaignId, shopId },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }

      if (existing.status === 'sent') {
        return NextResponse.json({ error: 'Campaign already sent' }, { status: 400 });
      }

      await prisma.campaign.update({
        where: { id: existing.id },
        data: { status: 'sending' },
      });

      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { shopName: true },
      });

      const delivered = await deliverCampaign(
        {
          id: existing.id,
          type: existing.type,
          subject: existing.subject,
          body: existing.body,
          shopId,
        },
        shop?.shopName || 'Your Auto Shop'
      );

      return NextResponse.json(delivered);
    }

    if (!name || !type || !messageBody) {
      return NextResponse.json({ error: 'Name, type, and message body are required' }, { status: 400 });
    }

    if (!['email', 'sms', 'both'].includes(type)) {
      return NextResponse.json({ error: 'Type must be email, sms, or both' }, { status: 400 });
    }

    if ((type === 'email' || type === 'both') && !subject) {
      return NextResponse.json({ error: 'Subject required for email campaigns' }, { status: 400 });
    }

    // Get customers who have work orders at this shop
    const customerIds = await prisma.workOrder.findMany({
      where: { shopId },
      select: { customerId: true },
      distinct: ['customerId'],
    });

    // Get shop name
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { shopName: true },
    });

    const campaign = await prisma.campaign.create({
      data: {
        shopId,
        name,
        type,
        subject: subject || null,
        body: messageBody,
        recipientCount: customerIds.length,
        status: sendNow ? 'sending' : 'draft',
      },
    });

    if (sendNow) {
      const shopName = shop?.shopName || 'Your Auto Shop';

      const delivered = await deliverCampaign(
        {
          id: campaign.id,
          type,
          subject: subject || null,
          body: messageBody,
          shopId,
        },
        shopName
      );

      return NextResponse.json(delivered);
    }

    return NextResponse.json(campaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}
