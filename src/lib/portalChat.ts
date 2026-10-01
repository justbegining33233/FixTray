import prisma from '@/lib/prisma';
import { decoratePortalMessages } from '@/lib/chatTranslationStore';
import { PortalRole, PortalChatMessage } from '@/types/portalChat';

// "pair:" channels are shared between tech+manager; all others are role-scoped.
function resolveRole(role: PortalRole, channelId: string): string {
  return channelId.startsWith('pair:') ? 'shared' : role;
}

export async function getPortalMessages(
  role: PortalRole,
  channelId = 'global',
  viewerLocale = 'en',
): Promise<PortalChatMessage[]> {
  try {
    const rows = await prisma.portalChatMessage.findMany({
      where: { role: resolveRole(role, channelId), channelId },
      orderBy: { timestamp: 'asc' },
      take: 200,
    });
    const shown = await decoratePortalMessages(rows, viewerLocale);
    return shown.map((r) => ({
      id: r.id,
      sender: r.sender,
      body: r.body,
      displayBody: r.displayBody,
      originalBody: r.originalBody,
      timestamp: r.timestamp,
      channelId: r.channelId,
    }));
  } catch (err) {
    console.error('[portalChat] getPortalMessages failed', err);
    return [];
  }
}

export async function addPortalMessage(
  role: PortalRole,
  sender: string,
  body: string,
  channelId = 'global',
  sourceLocale?: string | null,
  attribution?: { shopId?: string | null; actorId?: string | null },
): Promise<PortalChatMessage> {
  const row = await prisma.portalChatMessage.create({
    data: {
      role: resolveRole(role, channelId),
      channelId,
      sender,
      body,
      sourceLocale: sourceLocale || null,
      shopId: attribution?.shopId || null,
      actorId: attribution?.actorId || null,
    },
  });
  return {
    id: row.id,
    sender: row.sender,
    body: row.body,
    displayBody: row.body,
    originalBody: row.body,
    timestamp: row.timestamp,
    channelId: row.channelId,
  };
}
