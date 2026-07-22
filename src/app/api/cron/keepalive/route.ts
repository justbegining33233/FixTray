import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import prisma from '@/lib/prisma';

// Keep-alive cron — prevents Neon from hibernating.
// Runs every 5 minutes (requires Vercel Pro plan).
// On Hobby plan, increase the Neon "Suspend after inactivity" setting to
// the maximum allowed value to reduce cold-start frequency.
//
// Vercel calls this with a cron secret. Reject all other callers.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  // If CRON_SECRET is not configured, block all requests rather than
  // accidentally allowing anyone who sends "Bearer undefined".
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  try {
    // Lightweight query — just proves the connection is alive.
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[keepalive] DB ping failed', error);
    return NextResponse.json(
      { ok: false, error: String(error), latencyMs: Date.now() - start },
      { status: 500 }
    );
  }
}
