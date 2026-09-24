/** Who can see a direct message, and when it still counts as unread. */

export type MessageViewer = {
  id: string;
  role: string;
  shopId?: string | null;
};

export type DirectMessageParty = {
  senderId: string;
  senderRole: string;
  senderName?: string | null;
  receiverId: string;
  receiverRole: string;
  receiverName?: string | null;
  isRead?: boolean;
};

const SHOP_STAFF = new Set(['shop', 'manager', 'tech']);

/** Shop inbox id for a shop owner, manager, or tech. Customers have none. */
export function mailboxShopId(viewer: MessageViewer): string | null {
  if (viewer.role === 'shop') return viewer.id;
  if (viewer.role === 'manager' || viewer.role === 'tech') return viewer.shopId || null;
  return null;
}

/** Prisma OR clauses: the viewer's own threads plus their shop's mailbox. */
export function participantOrClauses(viewer: MessageViewer): Array<Record<string, string>> {
  const clauses: Array<Record<string, string>> = [
    { senderId: viewer.id, senderRole: viewer.role },
    { receiverId: viewer.id, receiverRole: viewer.role },
  ];
  const shopId = mailboxShopId(viewer);
  if (shopId && viewer.role !== 'shop') {
    clauses.push(
      { senderId: shopId, senderRole: 'shop' },
      { receiverId: shopId, receiverRole: 'shop' },
    );
  }
  return clauses;
}

export function markReadReceiverIds(viewer: MessageViewer): string[] {
  const ids = [viewer.id];
  const shopId = mailboxShopId(viewer);
  if (shopId && shopId !== viewer.id) ids.push(shopId);
  return ids;
}

/**
 * Thread filter for one contact. Includes messages the shop mailbox sent or
 * received so managers and techs see the same customer thread the shop does.
 */
export function threadAccessWhere(viewer: MessageViewer, contactId: string, contactRole?: string | null) {
  const shopId = mailboxShopId(viewer);
  const toContact = contactRole
    ? { receiverId: contactId, receiverRole: contactRole }
    : { receiverId: contactId };
  const fromContact = contactRole
    ? { senderId: contactId, senderRole: contactRole }
    : { senderId: contactId };

  const or: Array<Record<string, unknown>> = [
    { AND: [{ senderId: viewer.id, senderRole: viewer.role }, toContact] },
    { AND: [{ receiverId: { in: markReadReceiverIds(viewer) } }, fromContact] },
  ];
  if (shopId) {
    or.push({ AND: [{ senderId: shopId, senderRole: 'shop' }, toContact] });
  }
  return { OR: or };
}

export function isUnreadForViewer(message: DirectMessageParty, viewer: MessageViewer): boolean {
  if (message.isRead) return false;
  if (message.receiverId === viewer.id && message.receiverRole === viewer.role) return true;
  const shopId = mailboxShopId(viewer);
  return Boolean(shopId && message.receiverRole === 'shop' && message.receiverId === shopId);
}

/**
 * The other person in the thread. Shop-mailbox messages are grouped by the
 * customer (or other party), not by the shop, so staff see the customer thread.
 */
export function counterpartyForViewer(
  message: DirectMessageParty,
  viewer: MessageViewer,
): { otherId: string; otherRole: string; otherName: string } | null {
  const shopId = mailboxShopId(viewer);
  if (!shopId || !SHOP_STAFF.has(viewer.role)) return null;

  if (message.receiverRole === 'shop' && message.receiverId === shopId) {
    return {
      otherId: message.senderId,
      otherRole: message.senderRole,
      otherName: message.senderName || 'Contact',
    };
  }
  if (message.senderRole === 'shop' && message.senderId === shopId) {
    return {
      otherId: message.receiverId,
      otherRole: message.receiverRole,
      otherName: message.receiverName || 'Contact',
    };
  }
  return null;
}

export function messageIsOwn(
  message: { senderId: string; senderRole: string },
  viewer: { id: string; shopId?: string | null },
): boolean {
  if (message.senderId === viewer.id) return true;
  return Boolean(viewer.shopId && message.senderRole === 'shop' && message.senderId === viewer.shopId);
}
