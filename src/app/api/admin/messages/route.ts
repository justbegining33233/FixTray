import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { decorateDirectMessages, resolveAccountLocale } from '@/lib/chatTranslationStore';
import { partitionStaffInbox } from '@/lib/staffInbox';

/**
 * GET /api/admin/messages
 * Staff conversations are messages to or from platform staff.
 * Shop, work-order, and inventory alerts stay in `alerts` and are not conversations.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const stored = await prisma.directMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const viewerLocale = await resolveAccountLocale(request, auth);
    const messages = await decorateDirectMessages(stored, viewerLocale);
    const { conversations, alerts } = partitionStaffInbox(messages);

    const unreadMessages = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
    const userIds = new Set<string>();
    for (const conversation of conversations) {
      userIds.add(conversation.member.id);
    }
    const messagesSent24h = messages.filter((message) => {
      const created = new Date(message.createdAt).getTime();
      return Number.isFinite(created) && created >= Date.now() - 24 * 60 * 60 * 1000;
    }).length;

    return NextResponse.json({
      conversations: conversations.slice(0, 100).map((conversation) => ({
        id: conversation.id,
        senderId: conversation.member.id,
        senderName: conversation.member.name,
        senderRole: conversation.member.role,
        receiverId: conversation.id,
        receiverName: conversation.staffName,
        receiverRole: 'admin',
        subject: conversation.subject,
        body: conversation.preview,
        displayBody: conversation.preview,
        unreadCount: conversation.unreadCount,
        lastMessageAt: conversation.lastMessageAt,
        isRead: conversation.unreadCount === 0,
        replyTo: conversation.member,
        canReply: conversation.canReply,
        messages: conversation.messages.map((message) => ({
          id: message.id,
          senderId: message.senderId,
          senderName: message.senderName,
          senderRole: message.senderRole,
          body: message.displayBody || message.body,
          createdAt: message.createdAt,
        })),
      })),
      alerts: alerts.slice(0, 100),
      stats: {
        totalConversations: conversations.length,
        unreadMessages,
        activeUsers: userIds.size,
        messagesSent24h,
        avgResponseTime: 0,
        shopAlerts: alerts.length,
      },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
