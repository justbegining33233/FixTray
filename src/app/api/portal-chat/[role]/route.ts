import { NextRequest, NextResponse } from 'next/server';
import { addPortalMessage, getPortalMessages } from '@/lib/portalChat';
import { PortalRole } from '@/types/portalChat';
import { requireRole } from '@/lib/auth';
import { resolveAccountLocale } from '@/lib/chatTranslationStore';

export async function GET(req: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  const auth = requireRole(req, ['tech', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { role } = await params;
    if (!['tech', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    const channelId = req.nextUrl.searchParams.get('channel') || 'global';
    const viewerLocale = await resolveAccountLocale(req, auth);
    const messages = await getPortalMessages(role as PortalRole, channelId, viewerLocale);
    return NextResponse.json(messages);
  } catch (err) {
    console.error('Error fetching portal messages', err);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  const auth = requireRole(req, ['tech', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { role } = await params;
    if (!['tech', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const data = await req.json();
    const sender = (data?.sender || '').toString().trim() || 'user';
    const body = (data?.body || '').toString().trim();
    const channelId = (data?.channel || '').toString().trim() || 'global';
    if (!body) {
      return NextResponse.json({ error: 'Message body required' }, { status: 400 });
    }

    const viewerLocale = await resolveAccountLocale(req, auth);
    const shopId = auth.shopId || (auth.role === 'shop' ? auth.id : null);
    const msg = await addPortalMessage(role as PortalRole, sender, body, channelId, viewerLocale, {
      shopId,
      actorId: auth.id,
    });
    return NextResponse.json(msg, { status: 201 });
  } catch (err) {
    console.error('Error posting portal message', err);
    return NextResponse.json({ error: 'Failed to post message' }, { status: 500 });
  }
}
