import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { sendEstimateReadyEmail, sendJobCompletedEmail, sendStatusUpdateEmail, sendEmail } from '@/lib/emailService';
import { pushEstimateReady, pushJobCompleted } from '@/lib/serverPush';
import { sendSms } from '@/lib/smsService';
import { awardLoyaltyPoints } from '@/lib/loyaltyService';
import { dispatchWebhook } from '@/lib/webhookService';
import logger from '@/lib/logger';
import { getPlatformServiceFeeUsd } from '@/lib/platformFee';
import { redactPlatformFeeForRole } from '@/lib/staffMoneyAccess';
import { billWithServiceFee } from '@/lib/serviceFeeBill';

import { validateRequest, workOrderUpdateSchema } from '@/lib/validationSchemas';
import { customerWorkOrderUpdateForbidden } from '@/lib/customerWorkOrderUpdate';
import { hasWorkOrderFieldUpdates, legacyMessagesToStore, workOrderDirectMessage } from '@/lib/workOrderMessagePersist';
import { syncLowStockReorderAsks } from '@/lib/lowStockReorderAsk';
import { quantityAfterUse, stockDeltasForPartUse } from '@/lib/partStockUse';
import { decorateWorkOrderMessages, resolveAccountLocale, stampOutgoingTranslation } from '@/lib/chatTranslationStore';
import { workOrderLinkAllowed } from '@/lib/workOrderOwnership';

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
  
  let id = '';
  try {
    id = (await params).id;
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
      (auth.role === 'customer' && workOrder.customerId === auth.id) ||
      (auth.role === 'shop' && workOrder.shopId === auth.id) ||
      ((auth.role === 'tech' || auth.role === 'manager') && workOrder.shopId === auth.shopId);
    
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const viewerLocale = await resolveAccountLocale(request, auth);
    const messages = await decorateWorkOrderMessages(workOrder.messages, viewerLocale);
    const payload = redactPlatformFeeForRole(auth.role, {
      ...workOrder,
      messages,
      fixtrayServiceFee: await getPlatformServiceFeeUsd(),
    });
    return NextResponse.json(payload, { headers: corsHeaders });
  } catch (error) {
    logger.error('Error fetching work order', { error: error instanceof Error ? error.message : String(error), workOrderId: id });
    return NextResponse.json({ error: 'Failed to fetch work order' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  
  let id = '';
  try {
    id = (await params).id;
    const requestData = await request.json();
    if (auth.role === 'customer') {
      const forbidden = customerWorkOrderUpdateForbidden(requestData);
      if (forbidden) return NextResponse.json({ error: forbidden }, { status: 403 });
    }
    const legacyMessages = requestData?.messages;
    if (requestData && typeof requestData === 'object') delete requestData.messages;
    
    // Validate input data. Chat lines are stored separately; the strict
    // work-order schema does not accept a `messages` blob.
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
      (auth.role === 'shop' && current.shopId === auth.id) ||
      ((auth.role === 'tech' || auth.role === 'manager') && current.shopId === auth.shopId) ||
      (auth.role === 'customer' && current.customerId === auth.id);
    
    if (!canUpdate) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const existingThread = await prisma.message.findMany({
      where: { workOrderId: id },
      select: { sender: true, body: true },
    });
    const chatLines = legacyMessagesToStore(existingThread, legacyMessages, auth.role);
    if (chatLines.length > 0) {
      const sourceLocale = await resolveAccountLocale(request, auth);
      const customerName = current.customer
        ? `${current.customer.firstName || ''} ${current.customer.lastName || ''}`.trim()
        : 'Customer';
      const audiences = [
        { role: 'customer', id: current.customerId },
        { role: 'shop', id: current.shopId },
      ];
      if (current.assignedTechId) audiences.push({ role: 'tech', id: current.assignedTechId });
      for (const line of chatLines) {
        const stored = await prisma.message.create({
          data: {
            workOrderId: id,
            sender: line.sender,
            senderName: line.senderName,
            body: line.body,
            sourceLocale,
          },
        });
        const mirror = workOrderDirectMessage({
          workOrderId: id,
          shopId: current.shopId,
          shopName: current.shop?.shopName,
          customerId: current.customerId,
          customerName,
          senderRole: auth.role,
          senderId: auth.id,
          senderName: auth.role === 'customer' ? (customerName || line.senderName) : line.senderName,
          body: line.body,
        });
        let mirrorId: string | null = null;
        if (mirror) {
          try {
            const mirrored = await prisma.directMessage.create({ data: { ...mirror, sourceLocale } });
            mirrorId = mirrored.id;
          } catch (mirrorError) {
            logger.error('Work order chat line saved but shop inbox mirror failed', {
              error: mirrorError instanceof Error ? mirrorError.message : String(mirrorError),
              workOrderId: id,
            });
          }
        }
        await stampOutgoingTranslation({
          body: line.body,
          sourceLocale,
          audiences,
          persist: async (fields) => {
            await prisma.message.update({ where: { id: stored.id }, data: fields });
            if (mirrorId) await prisma.directMessage.update({ where: { id: mirrorId }, data: fields });
          },
        });
      }
    }

    if (!hasWorkOrderFieldUpdates(data)) {
      const viewerLocale = await resolveAccountLocale(request, auth);
      const messages = await decorateWorkOrderMessages(await prisma.message.findMany({
        where: { workOrderId: id },
        orderBy: { createdAt: 'asc' },
      }), viewerLocale);
      return NextResponse.json({ ...current, messages });
    }

    const configuredFee = await getPlatformServiceFeeUsd();
    const quotesCustomer = (data.status as string) === 'waiting-for-payment'
      || Boolean(data.estimatedCost && !current.estimatedCost);
    if (quotesCustomer && configuredFee == null) {
      return NextResponse.json({ error: 'The platform service fee is not configured.' }, { status: 409 });
    }
    const platformFeeUsd = configuredFee ?? 0;
    
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
      sendStatusUpdateEmail(current.customer.email, id, data.status, current.shopId).catch((err) => {
        logger.error('Failed to send status update email', { error: err instanceof Error ? err.message : String(err), workOrderId: id, status: data.status });
      });

      // Send branded job-completed email when shop submits estimate and work is done
      if ((data.status as string) === 'waiting-for-payment') {
        const completedBill = billWithServiceFee(current.estimatedCost || data.estimatedCost || 0, platformFeeUsd);
        const totalDue = completedBill.total;
        sendJobCompletedEmail(
          current.customer.email,
          `${current.customer.firstName} ${current.customer.lastName}`,
          id,
          totalDue,
          current.shop?.shopName || 'Your Shop',
          current.issueDescription || 'Vehicle Service',
          completedBill.serviceFee,
          current.shopId,
        ).catch((err) => {
          logger.error('Failed to send job completed email', { error: err instanceof Error ? err.message : String(err), workOrderId: id, totalDue });
        });
        pushJobCompleted(current.customerId, totalDue, id).catch((err) => {
          logger.error('Failed to send job completed push notification', { error: err instanceof Error ? err.message : String(err), workOrderId: id, customerId: current.customerId });
        });
      }
      
      // Create notification with the short id and service when that data exists
      const { workOrderNotificationCopy } = await import('@/lib/notificationCopy');
      const statusCopy = workOrderNotificationCopy({
        id,
        serviceType: (current as { serviceType?: unknown }).serviceType,
        issueDescription: current.issueDescription,
        status: String(data.status || ''),
        kind: 'status',
      });
      await prisma.notification.create({
        data: {
          customerId: current.customerId,
          type: 'status_update',
          title: statusCopy.title,
          message: statusCopy.body,
          workOrderId: id,
          deliveryMethod: 'in-app',
        },
      });

      // Dispatch webhook for status change
      const webhookEvent = data.status === 'closed' ? 'workorder.closed' : 'workorder.updated';
      dispatchWebhook(current.shopId, webhookEvent, { workOrderId: id, fromStatus: current.status, toStatus: data.status }).catch((err) => {
        logger.error('Failed to dispatch status change webhook', { error: err instanceof Error ? err.message : String(err), shopId: current.shopId, webhookEvent, workOrderId: id });
      });
    }
    
    // Send estimate email if estimated cost added
    if (data.estimatedCost && !current.estimatedCost) {
      const estimateBill = billWithServiceFee(data.estimatedCost, platformFeeUsd);
      const totalDue = estimateBill.total;
      sendEstimateReadyEmail(
        current.customer.email,
        `${current.customer.firstName} ${current.customer.lastName}`,
        id,
        estimateBill.subtotal,
        estimateBill.serviceFee,
        totalDue,
        current.shop?.shopName || 'Your Shop',
        current.issueDescription || 'Vehicle Service',
        current.shopId,
      ).catch((err) => {
        logger.error('Failed to send estimate ready email', { error: err instanceof Error ? err.message : String(err), workOrderId: id, estimatedCost: data.estimatedCost });
      });
      pushEstimateReady(current.customerId, totalDue, id).catch((err) => {
        logger.error('Failed to send estimate ready push notification', { error: err instanceof Error ? err.message : String(err), workOrderId: id, customerId: current.customerId });
      });

      // SMS notification for estimate ready
      if (current.customer.phone) {
        const feeNote = estimateBill.serviceFee > 0
          ? ` including FixTray Service Fee $${estimateBill.serviceFee.toFixed(2)}`
          : '';
        sendSms(
          current.customer.phone,
          `FixTray: Your estimate is ready — $${totalDue.toFixed(2)}${feeNote} for "${current.issueDescription?.slice(0, 40) || 'Vehicle Service'}". Review at fixtray.app/customer (WO: ...${id.slice(-6)})`,
          current.shopId,
        ).catch((err) => {
          logger.warn('Failed to send estimate ready SMS', { workOrderId: id, phone: current.customer.phone });
        });
      }

      // Dispatch webhook for estimate ready
      dispatchWebhook(current.shopId, 'estimate.ready', { workOrderId: id, estimatedCost: data.estimatedCost }).catch((err) => {
        logger.error('Failed to dispatch estimate ready webhook', { error: err instanceof Error ? err.message : String(err), shopId: current.shopId, workOrderId: id });
      });
      
      await prisma.notification.create({
        data: {
          customerId: current.customerId,
          type: 'estimate',
          title: 'Estimate Ready',
          message: `Your estimate for work order ${id} is ready: $${billWithServiceFee(data.estimatedCost, platformFeeUsd).total.toFixed(2)}`,
          workOrderId: id,
          deliveryMethod: 'in-app',
        },
      });
    }
    
    const nextCustomerId = data.customerId && data.customerId !== current.customerId ? data.customerId : null;
    const nextVehicleId = data.vehicleId && data.vehicleId !== current.vehicleId ? data.vehicleId : null;
    const nextTechId = data.assignedTechId && data.assignedTechId !== current.assignedTechId ? data.assignedTechId : null;
    if (nextCustomerId || nextVehicleId || nextTechId) {
      const [customer, vehicle, tech, customerJobs] = await Promise.all([
        nextCustomerId ? prisma.customer.findUnique({ where: { id: nextCustomerId }, select: { id: true } }) : Promise.resolve(null),
        nextVehicleId ? prisma.vehicle.findUnique({ where: { id: nextVehicleId }, select: { id: true, customerId: true } }) : Promise.resolve(null),
        nextTechId ? prisma.tech.findUnique({ where: { id: nextTechId }, select: { id: true, shopId: true } }) : Promise.resolve(null),
        nextCustomerId
          ? prisma.workOrder.findMany({ where: { customerId: nextCustomerId }, select: { shopId: true } })
          : Promise.resolve([]),
      ]);
      const allowed = workOrderLinkAllowed({
        shopId: current.shopId,
        customerId: current.customerId,
        nextCustomerId,
        nextVehicleId,
        nextTechId,
        customer: customer ? { id: customer.id, shopIds: [...new Set(customerJobs.map((job) => job.shopId))] } : null,
        vehicle,
        tech,
      });
      if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: 400 });
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
      awardLoyaltyPoints(current.customerId, id, paid).catch((err) => {
        logger.error('Failed to award loyalty points', { error: err instanceof Error ? err.message : String(err), customerId: current.customerId, workOrderId: id, amount: paid });
      });

      // Post-service follow-up: email + SMS asking for review
      const customerName = `${current.customer.firstName} ${current.customer.lastName}`;
      const shopName = current.shop?.shopName || 'Your Auto Shop';
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app';
      const reviewLink = `${appUrl}/customer/reviews?shopId=${current.shopId}`;

      sendEmail({
        to: current.customer.email,
        shopId: current.shopId,
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
      }).catch((err) => {
        logger.warn('Failed to send review request email', { workOrderId: id, customerId: current.customerId });
      });

      if (current.customer.phone) {
        sendSms(
          current.customer.phone,
          `Thank you for your visit to ${shopName}! We'd love your feedback: ${reviewLink}`,
          current.shopId,
        ).catch((err) => {
          logger.warn('Failed to send review request SMS', { workOrderId: id, customerId: current.customerId });
        });
      }
    }

    // Reduce on-hand quantity only for lines linked to an inventory row.
    // A custom line has no inventory id, so it does not change stock.
    // Saving the same parts again does not subtract them a second time.
    const partDeltas = Array.isArray(data.partsUsed)
      ? stockDeltasForPartUse(current.partsUsed, data.partsUsed)
      : [];
    if (partDeltas.length > 0) {
      const touchedStock: Array<{ id: string; name: string; quantity: number; reorderPoint: number | null }> = [];
      try {
        await prisma.$transaction(async (tx) => {
          for (const change of partDeltas) {
            const inventoryItem = await tx.inventoryItem.findFirst({
              where: { id: change.inventoryItemId, shopId: current.shopId },
            });
            if (!inventoryItem) continue;
            const quantity = quantityAfterUse(inventoryItem.quantity, change.delta);
            await tx.inventoryItem.update({
              where: { id: inventoryItem.id },
              data: { quantity },
            });
            touchedStock.push({
              id: inventoryItem.id,
              name: inventoryItem.name,
              quantity,
              reorderPoint: inventoryItem.reorderPoint,
            });
          }
        });
        if (touchedStock.length > 0) {
          try {
            await syncLowStockReorderAsks(current.shopId, touchedStock);
          } catch (err) {
            logger.error('Failed to ask manager about low stock', { error: err instanceof Error ? err.message : String(err), workOrderId: id, shopId: current.shopId });
          }
        }
      } catch (err) {
        logger.error('Failed to deduct inventory for closed work order', { error: err instanceof Error ? err.message : String(err), workOrderId: id, shopId: current.shopId });
      }
    }

    return NextResponse.json(updatedWorkOrder);
  } catch (error) {
    logger.error('Error updating work order', { error: error instanceof Error ? error.message : String(error), workOrderId: id });
    return NextResponse.json({ error: 'Failed to update work order' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  
  let id = '';
  try {
    id = (await params).id;
    
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
    logger.error('Error deleting work order', { error: error instanceof Error ? error.message : String(error), workOrderId: id });
    return NextResponse.json({ error: 'Failed to delete work order' }, { status: 500 });
  }
}
