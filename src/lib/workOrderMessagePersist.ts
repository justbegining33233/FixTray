/** Persist a work-order chat line, including the copy the shop inbox reads. */

export type ThreadKey = { sender: string; body: string };

export type StoredWorkOrderMessage = {
  sender: string;
  senderName: string;
  body: string;
};

export type DirectMessageInsert = {
  senderId: string;
  senderRole: string;
  senderName: string;
  receiverId: string;
  receiverRole: string;
  receiverName: string;
  shopId: string;
  subject: string;
  body: string;
};

const STAFF = new Set(['shop', 'tech', 'manager']);

/**
 * The live customer chat PUT `{ messages: [...] }` and the strict work-order
 * schema rejects that key, so the row never landed. Pull those lines out and
 * keep only new ones from the signed-in sender.
 */
export function legacyMessagesToStore(
  existing: ThreadKey[],
  incoming: unknown,
  actorRole: string,
): StoredWorkOrderMessage[] {
  if (!Array.isArray(incoming)) return [];
  const seen = new Set(existing.map((message) => `${message.sender}\n${message.body}`));
  const stored: StoredWorkOrderMessage[] = [];
  for (const raw of incoming) {
    if (!raw || typeof raw !== 'object') continue;
    const record = raw as { body?: unknown; sender?: unknown; senderName?: unknown };
    const body = typeof record.body === 'string' ? record.body.trim() : '';
    if (!body || body.length > 5000) continue;
    const claimedSender = typeof record.sender === 'string' ? record.sender.trim() : '';
    if (claimedSender && claimedSender !== actorRole) continue;
    const key = `${actorRole}\n${body}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const senderName = typeof record.senderName === 'string' && record.senderName.trim()
      ? record.senderName.trim()
      : actorRole;
    stored.push({ sender: actorRole, senderName, body });
  }
  return stored;
}

export function hasWorkOrderFieldUpdates(data: object): boolean {
  return Object.values(data).some((value) => value !== undefined);
}

/** Shop inbox row for a work-order chat line. Null when the work order has no shop. */
export function workOrderDirectMessage(input: {
  workOrderId: string;
  shopId?: string | null;
  shopName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  senderRole: string;
  senderId: string;
  senderName: string;
  body: string;
}): DirectMessageInsert | null {
  if (!input.shopId) return null;
  const body = input.body.trim();
  if (!body) return null;
  const subject = `WO-${input.workOrderId.slice(-8).toUpperCase()}`;
  if (STAFF.has(input.senderRole)) {
    if (!input.customerId) return null;
    return {
      senderId: input.senderRole === 'shop' ? input.senderId : input.shopId,
      senderRole: 'shop',
      senderName: input.shopName || input.senderName || 'Shop',
      receiverId: input.customerId,
      receiverRole: 'customer',
      receiverName: input.customerName || 'Customer',
      shopId: input.shopId,
      subject,
      body,
    };
  }
  if (input.senderRole === 'customer') {
    return {
      senderId: input.senderId,
      senderRole: 'customer',
      senderName: input.senderName || input.customerName || 'Customer',
      receiverId: input.shopId,
      receiverRole: 'shop',
      receiverName: input.shopName || 'Shop',
      shopId: input.shopId,
      subject,
      body,
    };
  }
  return null;
}
