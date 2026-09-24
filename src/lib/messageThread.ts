/** Reconcile a work-order thread with what the server actually stored. */

export type ThreadMessage = {
  id: string;
  sender: string;
  senderName?: string;
  body: string;
  timestamp: Date;
};

export function toThreadMessage(raw: {
  id?: string;
  sender?: string;
  senderName?: string | null;
  body?: string;
  createdAt?: string | Date | null;
  timestamp?: string | Date | null;
}): ThreadMessage | null {
  if (!raw?.id || !raw.body) return null;
  const stamp = raw.timestamp || raw.createdAt || new Date();
  const timestamp = new Date(stamp);
  if (Number.isNaN(timestamp.getTime())) return null;
  return {
    id: String(raw.id),
    sender: String(raw.sender || 'customer'),
    senderName: raw.senderName || undefined,
    body: String(raw.body),
    timestamp,
  };
}

/** Server rows win on id. Local rows the server has not returned yet are kept. */
export function mergeThreadMessages(existing: ThreadMessage[], incoming: ThreadMessage[]): ThreadMessage[] {
  const byId = new Map<string, ThreadMessage>();
  for (const message of existing) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return Array.from(byId.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}
