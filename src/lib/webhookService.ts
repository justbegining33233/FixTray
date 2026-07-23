import crypto from 'crypto';
import logger from '@/lib/logger';

/**
 * Dispatch a webhook event to all matching webhook endpoints for a shop.
 * Signs the payload with HMAC-SHA256 using the webhook secret.
 */
export async function dispatchWebhook(shopId: string, event: string, payload: Record<string, unknown>) {
  try {
    const prisma = (await import('@/lib/prisma')).default;

    const webhooks = await prisma.webhook.findMany({
      where: {
        shopId,
        active: true,
        failureCount: { lt: 10 },
      },
    });

    for (const webhook of webhooks) {
      // Check if webhook is subscribed to this event
      const subscribedEvents = webhook.events.split(',').map(e => e.trim());
      if (!subscribedEvents.includes(event) && !subscribedEvents.includes('*')) continue;

      const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });
      const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');

      // Fire-and-forget delivery with timeout
      deliverWebhook(webhook.id, webhook.url, body, signature).catch((err) => {
        logger.error('Webhook delivery error', {
          error: err instanceof Error ? err.message : String(err),
          webhookId: webhook.id,
          url: webhook.url,
          event
        });
      });
    }
  } catch (err) {
    logger.error('Error dispatching webhook', {
      error: err instanceof Error ? err.message : String(err),
      shopId,
      event
    });
  }
}

async function deliverWebhook(webhookId: string, url: string, body: string, signature: string) {
  const prisma = (await import('@/lib/prisma')).default;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-FixTray-Signature': `sha256=${signature}`,
        'X-FixTray-Event': JSON.parse(body).event,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        lastTriggeredAt: new Date(),
        lastStatus: response.status,
        failureCount: response.ok ? 0 : { increment: 1 },
      },
    });
  } catch {
    // Network error or timeout
    await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        lastTriggeredAt: new Date(),
        lastStatus: 0,
        failureCount: { increment: 1 },
      },
    }).catch((err) => {
      logger.error('Failed to update webhook failure count', {
        error: err instanceof Error ? err.message : String(err),
        webhookId
      });
    });
  }
}
