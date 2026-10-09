import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getPlatformServiceFeeUsd } from '@/lib/platformFee';
import { estimateBillForOrder } from '@/lib/customerLedger';
import { frozenCustomerFeeUsd } from '@/lib/feeSnapshot';
import { quoteAmount as closeoutQuote } from '@/lib/workOrderCloseout';
import { decorateWorkOrderMessages, resolveAccountLocale } from '@/lib/chatTranslationStore';
import { cardPaymentOfferForShop } from '@/lib/customerCardPayServer';
import { customerFacingTechnician } from '@/lib/customerTechnician';

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
            stripeAccountId: true,
          },
        },
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
          },
        },
        workOrderTimeEntries: {
          orderBy: { clockIn: 'desc' },
          select: {
            clockIn: true,
            tech: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
              },
            },
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
            sourceLocale: true,
            translations: true,
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
    const quoteAmount = closeoutQuote(workOrder) || Number(
      estimate?.amount ?? estimate?.total ?? workOrder.estimatedCost ?? 0
    ) || 0;
    const bill = estimateBillForOrder(
      {
        paymentStatus: workOrder.paymentStatus,
        amountPaid: workOrder.amountPaid,
        estimatedCost: quoteAmount,
        frozenCustomerFeeUsd: frozenCustomerFeeUsd(workOrder.completion, quoteAmount),
      },
      (await getPlatformServiceFeeUsd()) ?? 0,
    );
    const shownMessages = await decorateWorkOrderMessages(
      workOrder.messages || [],
      await resolveAccountLocale(request, { id: payload.id, role: payload.role }),
    );
    const cardPayment = await cardPaymentOfferForShop(workOrder.shop?.stripeAccountId);
    const punches = (workOrder.workOrderTimeEntries || []).map((entry) => ({
      firstName: entry.tech?.firstName || '',
      lastName: entry.tech?.lastName || '',
      phone: entry.tech?.phone || '',
      role: entry.tech?.role || '',
      clockIn: entry.clockIn.toISOString(),
    }));
    const technician = customerFacingTechnician({
      assigned: workOrder.assignedTo,
      punches,
    });
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
      cardPaymentAvailable: cardPayment.available,
      shop: workOrder.shop
        ? {
            shopName: workOrder.shop.shopName,
            phone: workOrder.shop.phone,
            address: workOrder.shop.address,
          }
        : null,
      assignedTo: technician
        ? {
            firstName: technician.firstName || '',
            lastName: technician.lastName || '',
            phone: technician.phone || '',
            role: technician.role || 'tech',
          }
        : null,
      punches,
      vehicle: workOrder.vehicle,
      tracking: workOrder.tracking || null,
      messages: shownMessages.map((message) => ({
        id: message.id,
        sender: message.sender,
        senderName: message.senderName,
        body: message.body,
        displayBody: message.displayBody,
        originalBody: message.originalBody,
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