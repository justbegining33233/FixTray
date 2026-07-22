import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

/**
 * GET /api/admin/messages
 * Returns platform-wide messaging overview
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    // Get all direct messages
    const messages = await prisma.directMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Get unread count
    const unreadCount = await prisma.directMessage.count({
      where: { isRead: false },
    });

    // Group into conversations
    const conversationMap = new Map<string, any>();
    messages.forEach(msg => {
      const key = [msg.senderId, msg.receiverId].sort().join('_');
      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          id: msg.threadId || key,
          senderId: msg.senderId,
          senderName: msg.senderName,
          senderRole: msg.senderRole,
          receiverId: msg.receiverId,
          receiverName: msg.receiverName,
          receiverRole: msg.receiverRole,
          subject: msg.subject,
          body: msg.body,
          lastMessageAt: msg.createdAt,
          unreadCount: msg.isRead ? 0 : 1,
          isRead: msg.isRead,
        });
      } else {
        const conv = conversationMap.get(key);
        if (!msg.isRead) conv.unreadCount += 1;
      }
    });

    const conversations = Array.from(conversationMap.values());

    // Get unique senders/receivers
    const userIds = new Set<string>();
    messages.forEach(m => {
      userIds.add(m.senderId);
      userIds.add(m.receiverId);
    });

    // Count messages sent in last 24h
    const messagesSent24h = await prisma.directMessage.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    return NextResponse.json({
      conversations: conversations.slice(0, 100),
      stats: {
        totalConversations: conversationMap.size,
        unreadMessages: unreadCount,
        activeUsers: userIds.size,
        messagesSent24h,
        avgResponseTime: 0, // Would require more complex calculation
      },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
