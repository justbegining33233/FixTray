import { NextRequest, NextResponse } from 'next/server';
import { getPortalMessages } from '@/lib/portalChat';
import { PortalRole } from '@/types/portalChat';
import { requireRole } from '@/lib/auth';
import { resolveAccountLocale } from '@/lib/chatTranslationStore';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  const auth = requireRole(req, ['tech', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { role } = await params;
  if (!['tech', 'manager'].includes(role)) {
    return new Response('Invalid role', { status: 400 });
  }
  const channelId = req.nextUrl.searchParams.get('channel') || 'global';
  const viewerLocale = await resolveAccountLocale(req, auth);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        const messages = await getPortalMessages(role as PortalRole, channelId, viewerLocale);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(messages)}\n\n`));
      };

      await send();
      const interval = setInterval(() => { send().catch(console.error); }, 2000);
      controller.enqueue(encoder.encode(': ping\n\n'));
      return () => clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
