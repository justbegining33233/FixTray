import { NextRequest, NextResponse } from 'next/server';
import { createDemoShopLogin } from '@/lib/demoShop';
import { checkRateLimit, getClientIP } from '@/lib/rateLimit';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    const ip = getClientIP(request);
    const byEmail = await checkRateLimit(`demo:${email}`, { maxRequests: 3, windowMs: 24 * 60 * 60 * 1000 });
    if (!byEmail.success) {
      return NextResponse.json({ error: byEmail.message || 'Too many requests. Try again later.' }, { status: 429 });
    }
    const byIp = await checkRateLimit(`demo-ip:${ip}`, { maxRequests: 8, windowMs: 60 * 60 * 1000 });
    if (!byIp.success) {
      return NextResponse.json({ error: byIp.message || 'Too many requests. Try again later.' }, { status: 429 });
    }

    await createDemoShopLogin(email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('[demo] request failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'We could not send the demo login. Email support@fixtray.app.' },
      { status: 503 },
    );
  }
}
