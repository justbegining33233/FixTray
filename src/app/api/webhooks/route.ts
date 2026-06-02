import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import crypto from 'crypto';

const VALID_EVENTS = [
  'workorder.created', 'workorder.updated', 'workorder.closed',
  'payment.received', 'appointment.created', 'appointment.cancelled',
  'inventory.low_stock', 'tech.clocked_in', 'tech.clocked_out',
  'estimate.ready', 'customer.created', '*',
];

// GET /api/webhooks — list webhooks for the shop
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop']);
  if (auth instanceof NextResponse) return auth;

  try {
    const webhooks = await prisma.webhook.findMany({
      where: { shopId: auth.id },
      select: {
        id: true,
        url: true,
        events: true,
        active: true,
        lastTriggeredAt: true,
        lastStatus: true,
        failureCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ webhooks, availableEvents: VALID_EVENTS });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 });
  }
}

// POST /api/webhooks — create a new webhook endpoint
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { url, events } = await request.json();
    if (!url || !events) {
      return NextResponse.json({ error: 'url and events are required' }, { status: 400 });
    }

    // Validate URL
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        return NextResponse.json({ error: 'Webhook URL must use HTTPS' }, { status: 400 });
      }
      // Block internal/private network targets to prevent SSRF
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.') || hostname.endsWith('.internal') || hostname.endsWith('.local')) {
        return NextResponse.json({ error: 'Webhook URL must not target internal networks' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Validate events
    const eventList = Array.isArray(events) ? events : events.split(',').map((e: string) => e.trim());
    for (const event of eventList) {
      if (!VALID_EVENTS.includes(event)) {
        return NextResponse.json({ error: `Invalid event: ${event}` }, { status: 400 });
      }
    }

    // Limit to 10 webhooks per shop
    const count = await prisma.webhook.count({ where: { shopId: auth.id } });
    if (count >= 10) {
      return NextResponse.json({ error: 'Maximum 10 webhooks per shop' }, { status: 400 });
    }

    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const webhook = await prisma.webhook.create({
      data: {
        shopId: auth.id,
        url,
        events: eventList.join(','),
        secret,
      },
    });

    return NextResponse.json({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      secret,
      message: 'Save the signing secret — it will not be shown again.',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
}

// DELETE /api/webhooks?id=xxx — delete a webhook
export async function DELETE(request: NextRequest) {
  const auth = requireRole(request, ['shop']);
  if (auth instanceof NextResponse) return auth;

  try {
    const webhookId = new URL(request.url).searchParams.get('id');
    if (!webhookId) {
      return NextResponse.json({ error: 'Webhook id required' }, { status: 400 });
    }

    const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook || webhook.shopId !== auth.id) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    await prisma.webhook.delete({ where: { id: webhookId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}
