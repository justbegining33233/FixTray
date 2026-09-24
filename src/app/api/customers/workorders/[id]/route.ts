import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getPlatformServiceFeeUsd } from '@/lib/platformFee';
import { billWithServiceFee } from '@/lib/serviceFeeBill';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload || payload.role !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workOrderId } = await params;

    // Fetch work order with related data
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        shop: {
          select: {
            shopName: true,
            phone: true,
            address: true,
          },
        },
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        vehicle: {
          select: {
            make: true,
            model: true,
            year: true,
            licensePlate: true,
          },
        },
        tracking: {
          select: {
            latitude: true,
            longitude: true,
            estimatedArrival: true,
          }
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            sender: true,
            senderName: true,
            body: true,
            createdAt: true,
          },
        },
      },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    // Verify the work order belongs to the authenticated customer
    if (workOrder.customerId !== payload.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Format the response
    const estimate = workOrder.estimate as any;
    const quoteAmount = Number(
      estimate?.amount ?? estimate?.total ?? workOrder.estimatedCost ?? 0
    ) || 0;
    const bill = billWithServiceFee(quoteAmount, await getPlatformServiceFeeUsd());
    const response = {
      id: workOrder.id,
      issueDescription: workOrder.issueDescription,
      status: workOrder.status,
      paymentStatus: workOrder.paymentStatus,
      serviceType: workOrder.maintenance || workOrder.repairs || 'General Service',
      scheduledDate: workOrder.dueDate?.toISOString() || workOrder.createdAt.toISOString(),
      dueDate: workOrder.dueDate?.toISOString() || null,
      serviceLocation: workOrder.serviceLocation || null,
      createdAt: workOrder.createdAt.toISOString(),
      shop: workOrder.shop,
      assignedTo: workOrder.assignedTo,
      vehicle: workOrder.vehicle,
      tracking: workOrder.tracking || null,
      messages: (workOrder.messages || []).map((message) => ({
        id: message.id,
        sender: message.sender,
        senderName: message.senderName,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        timestamp: message.createdAt.toISOString(),
      })),
      estimate: (estimate || quoteAmount > 0) ? {
        amount: bill.subtotal,
        serviceFee: bill.serviceFee,
        totalDue: bill.total,
        status: estimate?.status || null,
      } : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching work order details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}