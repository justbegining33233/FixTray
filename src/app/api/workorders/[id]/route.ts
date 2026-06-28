import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { sendEstimateReadyEmail, sendJobCompletedEmail, sendStatusUpdateEmail, sendEmail } from '@/lib/emailService';
import { pushEstimateReady, pushJobCompleted } from '@/lib/serverPush';
import { sendSms } from '@/lib/smsService';
import { awardLoyaltyPoints } from '@/lib/loyaltyService';
import { dispatchWebhook } from '@/lib/webhookService';

import { validateRequest, workOrderUpdateSchema } from '@/lib/validationSchemas';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  // Only include CORS headers when a specific origin is configured; otherwise
  // omit them and let browsers enforce their default same-origin policy.
  const corsOrigin = process.env.CORS_ORIGINS;
  const corsHeaders: Record<string, string> = corsOrigin
    ? {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    : {};
  
  try {
    const { id } = await params;
    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        shop: {
          select: {
            id: true,
            shopName: true,
            phone: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        vehicle: {
          select: {
            id: true,
            vehicleType: true,
            make: true,
            model: true,
            year: true,
            vin: true,
            licensePlate: true,
          },
        },
      },
    });
    
    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }
    
    // Check authorization
    const authorized = 
      (auth.role === 'superadmin') ||
      (auth.role === 'customer' && workOrder.customerId === auth.id) ||
      (auth.role === 'shop' && workOrder.shopId === auth.id) ||
      ((auth.role === 'tech' || auth.role === 'manager') && workOrder.shopId === auth.shopId);
    
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    return NextResponse.json(workOrder, { headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching work order:', error);
    return NextResponse.json({ error: 'Failed to fetch work order' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  
  try {
    const { id } = await params;
    const requestData = await request.json();
    
    // Validate input data
    const validation = validateRequest(workOrderUpdateSchema, requestData);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }
    
    const data = validation.data;
    
    // Get current work order
    const current = await prisma.workOrder.findUnique({
      where: { id },
      include: { customer: true, shop: { select: { shopName: true, email: true } } },
    });
    
    if (!current) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }
    
    // Check authorization
    const canUpdate = 
      (auth.role === 'superadmin') ||
      (auth.role === 'shop' && current.shopId === auth.id) ||
      ((auth.role === 'tech' || auth.role === 'manager') && current.shopId === auth.shopId) ||
      (auth.role === 'customer' && current.customerId === auth.id);
    
    if (!canUpdate) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    // Track status change
    if (data.status && data.status !== current.status) {
      await prisma.statusHistory.create({
        data: {
          workOrderId: id,
          fromStatus: current.status,
          toStatus: data.status,
          reason: data.statusReason || 'Status updated',
          changedById: auth.role === 'tech' || auth.role === 'manager' ? auth.id : undefined,
        },
      });
      
      // Send status update email (basic)
      sendStatusUpdateEmail(current.customer.email, id, data.status).catch(console.error);

      // Send branded job-completed email when shop submits estimate and work is done
      if ((data.status as string) === 'waiting-for-payment') {
        const totalDue = (current.estimatedCost || data.estimatedCost || 0) + 5;
        sendJobCompletedEmail(
          current.customer.email,
          `${current.customer.firstName} ${current.customer.lastName}`,
          id,
          totalDue,
          current.shop?.shopName || 'Your Shop',
          current.issueDescription || 'Vehicle Service'
        ).catch(console.error);
        pushJobCompleted(current.customerId, totalDue, id).catch(console.error);
      }
      
      // Create notification
      await prisma.notification.create({
        data: {
          customerId: current.customerId,
          type: 'status_update',
          title: 'Work Order Status Updated',
          message: `Your work order ${id} status changed to ${data.status}`,
          workOrderId: id,
          deliveryMethod: 'in-app',
        },
      });

      // Dispatch webhook for status change
      const webhookEvent = data.status === 'closed' ? 'workorder.closed' : 'workorder.updated';
      dispatchWebhook(current.shopId, webhookEvent, { workOrderId: id, fromStatus: current.status, toStatus: data.status }).catch(() => {});
    }
    
    // Send estimate email if estimated cost added
    if (data.estimatedCost && !current.estimatedCost) {
      // Send branded estimate-ready email via Resend
      const totalDue = data.estimatedCost + 5;
      sendEstimateReadyEmail(
        current.customer.email,
        `${current.customer.firstName} ${current.customer.lastName}`,
        id,
        data.estimatedCost,
        totalDue,
        current.shop?.shopName || 'Your Shop',
        current.issueDescription || 'Vehicle Service'
      ).catch(console.error);
      pushEstimateReady(current.customerId, totalDue, id).catch(console.error);

      // SMS notification for estimate ready
      if (current.customer.phone) {
        sendSms(
          current.customer.phone,
          `FixTray: Your estimate is ready — $${data.estimatedCost.toFixed(2)} for "${current.issueDescription?.slice(0, 40) || 'Vehicle Service'}". Review at fixtray.app/customer (WO: ...${id.slice(-6)})`
        ).catch(() => {});
      }

      // Dispatch webhook for estimate ready
      dispatchWebhook(current.shopId, 'estimate.ready', { workOrderId: id, estimatedCost: data.estimatedCost }).catch(() => {});
      
      await prisma.notification.create({
        data: {
          customerId: current.customerId,
          type: 'estimate',
          title: 'Estimate Ready',
          message: `Your estimate for work order ${id} is ready: $${data.estimatedCost}`,
          workOrderId: id,
          deliveryMethod: 'in-app',
        },
      });
    }
    
    const updatedWorkOrder = await prisma.workOrder.update({
      where: { id },
      data: {
        issueDescription: data.issueDescription,
        status: data.status,
        bay: data.bay,
        assignedTechId: data.assignedTechId,
        customerId: data.customerId,
        vehicleId: data.vehicleId,
        estimatedCost: data.estimatedCost,
        amountPaid: data.amountPaid,
        estimate: data.estimate,
        techLabor: data.techLabor,
        partsUsed: data.partsUsed,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        completedAt: data.completedAt ? new Date(data.completedAt) : (data.status === 'closed' ? new Date() : undefined),
      },
      include: {
        customer: true,
        shop: true,
        assignedTo: true,
      },
    });

    // Award loyalty points when work order is closed
    if (data.status === 'closed' && current.status !== 'closed') {
      const paid = data.amountPaid || current.amountPaid || current.estimatedCost || 0;
      awardLoyaltyPoints(current.customerId, id, paid).catch(console.error);

      // Post-service follow-up: email + SMS asking for review
      const customerName = `${current.customer.firstName} ${current.customer.lastName}`;
      const shopName = current.shop?.shopName || 'Your Auto Shop';
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app';
      const reviewLink = `${appUrl}/customer/reviews?shopId=${current.shopId}`;

      sendEmail({
        to: current.customer.email,
        subject: `How was your experience at ${shopName}?`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e5332a;">Thank you, ${customerName}!</h2>
            <p>Your service at <strong>${shopName}</strong> is complete.</p>
            <p>We'd love to hear about your experience. Your feedback helps us improve and helps other customers find great service.</p>
            <a href="${reviewLink}" style="display: inline-block; background: #e5332a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600;">
              Leave a Review
            </a>
            <p style="color: #888; font-size: 12px; margin-top: 30px;">Thank you for choosing ${shopName}!</p>
          </div>
        `,
      }).catch(console.error);

      if (current.customer.phone) {
        sendSms(
          current.customer.phone,
          `Thank you for your visit to ${shopName}! We'd love your feedback: ${reviewLink}`
        ).catch(() => {});
      }
    }

    // Auto-deduct inventory when a work order is closed with parts usage.
    if (data.status === 'closed' && current.status !== 'closed' && Array.isArray(data.partsUsed) && data.partsUsed.length > 0) {
      for (const part of data.partsUsed) {
        const qty = Number(part?.quantity) || 0;
        if (qty <= 0) continue;
        if (!part?.sku && !part?.name) continue;

        const inventoryItem = await prisma.inventoryItem.findFirst({
          where: {
            shopId: current.shopId,
            OR: [
              ...(part?.sku ? [{ sku: String(part.sku) }] : []),
              ...(part?.name ? [{ name: String(part.name) }] : []),
            ],
          },
        });

        if (!inventoryItem) continue;

        await prisma.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            quantity: Math.max(0, inventoryItem.quantity - qty),
          },
        });
      }
    }

    return NextResponse.json(updatedWorkOrder);
  } catch (error) {
    console.error('Error updating work order:', error);
    return NextResponse.json({ error: 'Failed to update work order' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  
  try {
    const { id } = await params;
    
    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
    });
    
    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }
    
    // Only admin or customer who created it can delete
    if (auth.role !== 'superadmin' && (auth.role !== 'customer' || workOrder.customerId !== auth.id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    await prisma.workOrder.delete({ where: { id } });
    
    return NextResponse.json({ message: 'Work order deleted' });
  } catch (error) {
    console.error('Error deleting work order:', error);
    return NextResponse.json({ error: 'Failed to delete work order' }, { status: 500 });
  }
}
