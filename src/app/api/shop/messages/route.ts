import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// DEPRECATED: Uses legacy Message model scoped to work orders.
// New chat functionality uses /api/messages (DirectMessage model).
// This route is kept for backwards compatibility with shop/admin dashboard.

// GET - Get all messages in the shop (from work orders)
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    // Data isolation: the requested shopId must belong to the authenticated user
    // (admins/superadmins can query any shop)
    if (decoded.role !== 'superadmin' && shopId && shopId !== decoded.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limit = parseInt(searchParams.get('limit') || '50');

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
    }

    // Verify user has access to this shop
    if (decoded.role === 'shop') {
      if (decoded.id !== shopId) {
        return NextResponse.json({ error: 'Access denied to this shop' }, { status: 403 });
      }
    } else if (decoded.role === 'manager' || decoded.role === 'tech') {
      const tech = await prisma.tech.findFirst({
        where: {
          id: decoded.id,
          shopId: shopId,
        },
      });
      
      if (!tech) {
        return NextResponse.json({ error: 'Access denied to this shop' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized - Shop access only' }, { status: 403 });
    }

    // Get all messages from work orders belonging to this shop
    const messages = await prisma.message.findMany({
      where: {
        workOrder: {
          shopId,
        },
      },
      include: {
        workOrder: {
          select: {
            id: true,
            issueDescription: true,
            vehicleType: true,
            status: true,
            customer: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    // Format messages with work order context
    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      sender: msg.sender,
      senderName: msg.senderName,
      body: msg.body,
      createdAt: msg.createdAt,
      workOrder: {
        id: msg.workOrder.id,
        issue: msg.workOrder.issueDescription,
        vehicleType: msg.workOrder.vehicleType,
        status: msg.workOrder.status,
        customer: msg.workOrder.customer
          ? `${msg.workOrder.customer.firstName} ${msg.workOrder.customer.lastName}`
          : 'Unknown',
      },
    }));

    // Get message statistics
    const stats = {
      totalMessages: messages.length,
      byRole: {
        customer: messages.filter((m) => m.sender === 'customer').length,
        tech: messages.filter((m) => m.sender === 'tech').length,
        manager: messages.filter((m) => m.sender === 'manager').length,
      },
      recentActivity: messages.filter(
        (m) => new Date(m.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
      ).length,
    };

    return NextResponse.json({
      messages: formattedMessages,
      stats,
    });
  } catch (error) {
    console.error('Error fetching shop messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
