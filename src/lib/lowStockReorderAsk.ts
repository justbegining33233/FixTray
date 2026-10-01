/**
 * Ask the shop's manager to reorder, using the direct-message inbox they
 * already read (shop mailbox, bell, and /manager/messages).
 *
 * One message per item per low-stock episode. The open message's subject is
 * the marker: page loads do not send another while it is open. When the
 * quantity is above the reorder point, that subject is closed so the next
 * drop can ask again.
 */

export type LowStockNoticeState = 'open' | 'closed' | 'none';

export type LowStockAskItem = {
  id: string;
  name: string;
  quantity: number;
  reorderPoint?: number | null;
};

export type LowStockAskAction =
  | { action: 'ask'; body: string; subject: string; threadId: string }
  | { action: 'close'; subject: string }
  | { action: 'skip' };

export function lowStockAskThreadId(itemId: string): string {
  return `low-stock:${itemId}`;
}

export function lowStockAskSubject(itemId: string, state: 'open' | 'closed'): string {
  return `low-stock-${state}:${itemId}`;
}

export function parseLowStockAskSubject(
  subject: string | null | undefined,
  itemId: string,
): LowStockNoticeState {
  if (subject === lowStockAskSubject(itemId, 'open')) return 'open';
  if (subject === lowStockAskSubject(itemId, 'closed')) return 'closed';
  return 'none';
}

/** Names the item and asks whether to order more. */
export function lowStockReorderAskBody(item: {
  name: string;
  quantity: number;
  reorderPoint: number;
}): string {
  const name = item.name.trim() || 'An item';
  return `${name} is at or below its reorder point (${item.quantity} on hand, reorder at ${item.reorderPoint}). Do you want to order more?`;
}

export function isAtOrBelowReorderPoint(item: {
  quantity?: number | null;
  reorderPoint?: number | null;
}): boolean {
  if (item.reorderPoint == null || !Number.isFinite(item.reorderPoint)) return false;
  const quantity = Number(item.quantity);
  if (!Number.isFinite(quantity)) return false;
  return quantity <= item.reorderPoint;
}

/**
 * Decide the next inbox write for one item.
 * An open notice means this episode was already asked about.
 */
export function nextLowStockAsk(input: {
  itemId: string;
  name: string;
  quantity: number;
  reorderPoint?: number | null;
  notice: LowStockNoticeState;
}): LowStockAskAction {
  const low = isAtOrBelowReorderPoint(input);
  if (!low) {
    if (input.notice === 'open') {
      return { action: 'close', subject: lowStockAskSubject(input.itemId, 'closed') };
    }
    return { action: 'skip' };
  }
  if (input.notice === 'open') return { action: 'skip' };
  const reorderPoint = input.reorderPoint as number;
  return {
    action: 'ask',
    body: lowStockReorderAskBody({
      name: input.name,
      quantity: input.quantity,
      reorderPoint,
    }),
    subject: lowStockAskSubject(input.itemId, 'open'),
    threadId: lowStockAskThreadId(input.itemId),
  };
}

/** Shop-mailbox message. Managers already receive this inbox in their bell. */
export function lowStockAskDraft(input: {
  shopId: string;
  shopName: string;
  body: string;
  subject: string;
  threadId: string;
}) {
  return {
    senderId: input.threadId,
    senderRole: 'shop' as const,
    senderName: 'Inventory',
    receiverId: input.shopId,
    receiverRole: 'shop' as const,
    receiverName: input.shopName || 'Shop',
    shopId: input.shopId,
    subject: input.subject,
    body: input.body,
    threadId: input.threadId,
    isRead: false,
  };
}

/**
 * Create or close reorder asks for the items passed in.
 * Items that are not included are left alone.
 */
export async function syncLowStockReorderAsks(shopId: string, items: LowStockAskItem[]): Promise<void> {
  if (!shopId || items.length === 0) return;
  const prisma = (await import('@/lib/prisma')).default;
  const threadIds = items.map((item) => lowStockAskThreadId(item.id));
  const existing = await prisma.directMessage.findMany({
    where: { shopId, threadId: { in: threadIds } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, threadId: true, subject: true },
  });

  const latest = new Map<string, { id: string; subject: string | null }>();
  for (const row of existing) {
    if (!row.threadId || latest.has(row.threadId)) continue;
    latest.set(row.threadId, { id: row.id, subject: row.subject });
  }

  const asks: Array<{ body: string; subject: string; threadId: string }> = [];
  const closes: Array<{ id: string; subject: string }> = [];

  for (const item of items) {
    const threadId = lowStockAskThreadId(item.id);
    const prior = latest.get(threadId);
    const next = nextLowStockAsk({
      itemId: item.id,
      name: item.name,
      quantity: item.quantity,
      reorderPoint: item.reorderPoint,
      notice: parseLowStockAskSubject(prior?.subject, item.id),
    });
    if (next.action === 'ask') {
      asks.push({ body: next.body, subject: next.subject, threadId: next.threadId });
    } else if (next.action === 'close' && prior) {
      closes.push({ id: prior.id, subject: next.subject });
    }
  }

  for (const close of closes) {
    await prisma.directMessage.update({
      where: { id: close.id },
      data: { subject: close.subject },
    });
  }

  if (asks.length === 0) return;

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { shopName: true },
  });
  const shopName = shop?.shopName || 'Shop';

  for (const ask of asks) {
    await prisma.directMessage.create({
      data: lowStockAskDraft({
        shopId,
        shopName,
        body: ask.body,
        subject: ask.subject,
        threadId: ask.threadId,
      }),
    });
    const opens = await prisma.directMessage.findMany({
      where: { shopId, threadId: ask.threadId, subject: ask.subject },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const extraIds = opens.slice(1).map((row) => row.id);
    if (extraIds.length > 0) {
      await prisma.directMessage.deleteMany({ where: { id: { in: extraIds } } });
    }
  }
}
