import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { sendInventoryRequestNotification, sendInventoryApprovalNotification, sendLowStockAlert } from '@/lib/emailService';

// GET - Get inventory requests
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

    const status = searchParams.get('status');

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
    }

    // Verify caller owns or belongs to this shop (IDOR prevention)
    if (decoded.role !== 'superadmin') {
      const callerShopId = decoded.role === 'shop' ? decoded.id : decoded.shopId;
      if (!callerShopId || shopId !== callerShopId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const where: any = { shopId };
    if (status) {
      where.status = status;
    }

    const requests = await prisma.inventoryRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Get requester names
    const requestsWithNames = await Promise.all(
      requests.map(async (req) => {
        const tech = await prisma.tech.findUnique({
          where: { id: req.requestedById },
          select: { firstName: true, lastName: true, role: true },
        });
        return {
          ...req,
          requesterName: tech ? `${tech.firstName} ${tech.lastName}` : 'Unknown',
          requesterRole: tech?.role || 'unknown',
        };
      })
    );

    return NextResponse.json({ requests: requestsWithNames });
  } catch (error) {
    console.error('Error fetching inventory requests:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

// POST - Create inventory request
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { shopId, requestedById, itemName, quantity, reason, urgency } = await request.json();

    if (!shopId || !requestedById || !itemName || !quantity) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const inventoryRequest = await prisma.inventoryRequest.create({
      data: {
        shopId,
        requestedById,
        itemName,
        quantity,
        reason,
        urgency: urgency || 'normal',
        status: 'pending',
      },
    });

    // Send email notification to shop admin
    try {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { email: true, shopName: true },
      });
      
      if (shop?.email) {
        await sendInventoryRequestNotification(
          shop.email,
          shop.shopName,
          itemName,
          quantity,
          urgency || 'normal'
        );
      }
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({ 
      request: inventoryRequest, 
      message: 'Inventory request created successfully' 
    });
  } catch (error) {
    console.error('Error creating inventory request:', error);
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }
}

// PATCH - Update inventory request status
export async function PATCH(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'shop') {
      return NextResponse.json({ error: 'Unauthorized - Shop admin only' }, { status: 403 });
    }

    const { requestId, status, orderDetails, approvedBy } = await request.json();

    if (!requestId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get the request details
    const inventoryRequest = await prisma.inventoryRequest.findUnique({
      where: { id: requestId },
    });

    if (!inventoryRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const updateData: any = { status };
    
    if (status === 'approved' || status === 'denied') {
      updateData.approvedBy = approvedBy || decoded.id;
      updateData.approvedAt = new Date();
    }
    
    if (orderDetails) {
      updateData.orderDetails = orderDetails;
    }

    // If approved, try to auto-deduct from inventory
    if (status === 'approved') {
      // Find matching inventory item
      const inventoryItem = await prisma.inventoryStock.findFirst({
        where: {
          shopId: inventoryRequest.shopId,
          itemName: {
            contains: inventoryRequest.itemName,
          },
        },
      });

      if (inventoryItem) {
        // Deduct quantity from inventory
        const newQuantity = Math.max(0, inventoryItem.quantity - inventoryRequest.quantity);
        
        await prisma.inventoryStock.update({
          where: { id: inventoryItem.id },
          data: { quantity: newQuantity },
        });

        updateData.inventoryItemId = inventoryItem.id;
        
        // Check if below reorder point
        if (newQuantity <= inventoryItem.reorderPoint) {
          // Send email notification for low stock
          const shop = await prisma.shop.findUnique({ where: { id: inventoryRequest.shopId }, select: { email: true } });
          if (shop?.email) {
            await sendLowStockAlert(shop.email, inventoryItem.itemName, newQuantity, inventoryItem.reorderPoint);
          }
        }
      }
    }

    const updatedRequest = await prisma.inventoryRequest.update({
      where: { id: requestId },
      data: updateData,
    });

    // Send email notification to requester
    if (status === 'approved' || status === 'denied') {
      try {
        const tech = await prisma.tech.findUnique({
          where: { id: inventoryRequest.requestedById },
          select: { email: true },
        });
        
        if (tech?.email) {
          await sendInventoryApprovalNotification(
            tech.email,
            inventoryRequest.itemName,
            inventoryRequest.quantity,
            status === 'approved',
            orderDetails
          );
        }
      } catch (emailError) {
        console.error('Failed to send approval email:', emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({ 
      request: updatedRequest, 
      message: 'Request updated successfully',
      inventoryUpdated: status === 'approved' && updateData.inventoryItemId ? true : false,
    });
  } catch (error) {
    console.error('Error updating inventory request:', error);
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
  }
}
