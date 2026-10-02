/**
 * Platform messaging.
 * Shop, work-order, and inventory alerts are not messages to staff.
 * A conversation is a thread where a member or customer wrote to staff,
 * or staff wrote back. Opening it has a reply target.
 */

import { isPlatformStaffRole } from '@/lib/directMessageAccess';

export { isPlatformStaffRole };

export type InboxMessage = {
  id: string;
  senderId: string;
  senderName?: string | null;
  senderRole?: string | null;
  receiverId: string;
  receiverName?: string | null;
  receiverRole?: string | null;
  subject?: string | null;
  body?: string | null;
  displayBody?: string | null;
  isRead?: boolean | null;
  createdAt: Date | string;
  threadId?: string | null;
};

export type AlertKind = 'inventory' | 'work-order' | 'shop';

export type ReplyTarget = {
  id: string;
  role: string;
  name: string;
};

export function alertKind(message: InboxMessage): AlertKind | null {
  if (isPlatformStaffRole(message.senderRole) || isPlatformStaffRole(message.receiverRole)) return null;
  const subject = String(message.subject || '');
  const threadId = String(message.threadId || '');
  const senderName = String(message.senderName || '').trim().toLowerCase();
  if (threadId.startsWith('low-stock:') || subject.startsWith('low-stock') || senderName === 'inventory') {
    return 'inventory';
  }
  if (subject.startsWith('WO-')) return 'work-order';
  return 'shop';
}

export function isStaffMessage(message: InboxMessage): boolean {
  return alertKind(message) === null;
}

function time(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function memberParty(message: InboxMessage): ReplyTarget | null {
  const senderStaff = isPlatformStaffRole(message.senderRole);
  const receiverStaff = isPlatformStaffRole(message.receiverRole);
  if (senderStaff && !receiverStaff) {
    return {
      id: message.receiverId,
      role: String(message.receiverRole || ''),
      name: message.receiverName || 'Member',
    };
  }
  if (receiverStaff && !senderStaff) {
    return {
      id: message.senderId,
      role: String(message.senderRole || ''),
      name: message.senderName || 'Member',
    };
  }
  return null;
}

function conversationKey(message: InboxMessage): string {
  const member = memberParty(message);
  if (!member) {
    return [message.senderId, message.receiverId].sort().join(':');
  }
  const staffId = isPlatformStaffRole(message.senderRole) ? message.senderId : message.receiverId;
  return `staff:${staffId}:member:${member.role}:${member.id}`;
}

export type StaffConversation = {
  id: string;
  member: ReplyTarget;
  staffName: string;
  subject?: string | null;
  preview: string;
  lastMessageAt: string;
  unreadCount: number;
  messages: InboxMessage[];
  canReply: true;
};

export type ShopAlert = {
  id: string;
  kind: AlertKind;
  label: string;
  senderName: string;
  receiverName: string;
  subject?: string | null;
  preview: string;
  lastMessageAt: string;
  canReply: false;
};

const ALERT_LABEL: Record<AlertKind, string> = {
  inventory: 'Inventory alert',
  'work-order': 'Work order thread',
  shop: 'Shop message',
};

export function partitionStaffInbox(rows: InboxMessage[]): {
  conversations: StaffConversation[];
  alerts: ShopAlert[];
} {
  const staffRows = rows.filter((row) => isStaffMessage(row));
  const alertRows = rows.filter((row) => !isStaffMessage(row));
  const grouped = new Map<string, InboxMessage[]>();
  for (const row of staffRows) {
    const member = memberParty(row);
    if (!member) continue;
    const key = conversationKey(row);
    const list = grouped.get(key) || [];
    list.push(row);
    grouped.set(key, list);
  }

  const conversations: StaffConversation[] = [...grouped.entries()].map(([id, messages]): StaffConversation => {
    const ordered = [...messages].sort((a, b) => time(a.createdAt) - time(b.createdAt));
    const latest = ordered[ordered.length - 1];
    const member = memberParty(latest) || memberParty(ordered[0])!;
    const staffName = isPlatformStaffRole(latest.senderRole)
      ? (latest.senderName || 'Staff')
      : (latest.receiverName || 'Staff');
    const unreadCount = ordered.filter((row) => !row.isRead && isPlatformStaffRole(row.receiverRole)).length;
    return {
      id,
      member,
      staffName,
      subject: latest.subject,
      preview: String(latest.displayBody || latest.body || ''),
      lastMessageAt: new Date(time(latest.createdAt)).toISOString(),
      unreadCount,
      messages: ordered,
      canReply: true as const,
    };
  }).sort((a, b) => time(b.lastMessageAt) - time(a.lastMessageAt));

  const alerts: ShopAlert[] = alertRows
    .map((row) => {
      const kind = alertKind(row) || 'shop';
      return {
        id: row.id,
        kind,
        label: ALERT_LABEL[kind],
        senderName: row.senderName || 'Shop',
        receiverName: row.receiverName || 'Shop',
        subject: row.subject,
        preview: String(row.displayBody || row.body || ''),
        lastMessageAt: new Date(time(row.createdAt)).toISOString(),
        canReply: false as const,
      };
    })
    .sort((a, b) => time(b.lastMessageAt) - time(a.lastMessageAt));

  return { conversations, alerts };
}
