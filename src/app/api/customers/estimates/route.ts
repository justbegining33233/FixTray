import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findUnconfiguredShopServices } from '@/lib/shopServiceValidation';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get customer's estimates/work orders
    const estimates = await prisma.workOrder.findMany({
      where: {
        customerId: decoded.id,
        status: {
          in: ['pending', 'accepted', 'denied']
        }
      },
      include: {
        customer: true,
        shop: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform to match frontend expectations
    const transformedEstimates = estimates.map(estimate => ({
      id: estimate.id.toString(),
      status: estimate.status,
      service: 'Service',
      price: 0, // We'll need to add pricing logic later
      shop: estimate.shop?.shopName || 'Shop',
      description: '',
      validUntil: estimate.dueDate?.toISOString() || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: estimate.createdAt.toISOString(),
    }));

    return NextResponse.json({
      estimates: transformedEstimates,
      pendingCount: transformedEstimates.filter(e => e.status === 'pending').length
    });

  } catch (error) {
    console.error('Error fetching estimates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const shopId = String(body.shopId || '').trim();
    const serviceType = String(body.serviceType || '').trim();
    const description = String(body.description || '').trim();

    if (!shopId) {
      return NextResponse.json({ error: 'Please select a shop' }, { status: 400 });
    }
    if (!serviceType) {
      return NextResponse.json({ error: 'Please select a service' }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: 'Please describe the work you need' }, { status: 400 });
    }

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, shopName: true, status: true },
    });
    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const serviceValidation = await findUnconfiguredShopServices(shopId, [serviceType]);
    if (!serviceValidation.hasConfiguredServices) {
      return NextResponse.json(
        { error: 'This shop has no services configured.' },
        { status: 400 }
      );
    }
    if (serviceValidation.invalidServices.length > 0) {
      return NextResponse.json(
        { error: 'The selected service is not offered by this shop.', invalidServices: serviceValidation.invalidServices },
        { status: 400 }
      );
    }

    const issueDescription = `${serviceType}: ${description}`;
    const workOrder = await prisma.workOrder.create({
      data: {
        customerId: decoded.id,
        shopId,
        vehicleType: 'personal-vehicle',
        serviceLocation: 'in-shop',
        issueDescription,
        maintenance: [serviceType],
        status: 'pending',
        estimate: {
          status: 'requested',
          serviceType,
          details: description,
          total: 0,
          requestedAt: new Date().toISOString(),
        },
      },
      include: {
        shop: { select: { id: true, shopName: true } },
      },
    });

    try {
      await prisma.notification.create({
        data: {
          customerId: decoded.id,
          type: 'estimate',
          title: 'Estimate request sent',
          message: `Your estimate request for ${serviceType} was sent to ${shop.shopName || 'the shop'}.`,
          workOrderId: workOrder.id,
          deliveryMethod: 'in-app',
        },
      });
    } catch (err) {
      logger.warn('[customer-estimates] Failed to create notification', {
        error: err instanceof Error ? err.message : String(err),
        workOrderId: workOrder.id,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Estimate request submitted',
      estimate: {
        id: workOrder.id,
        status: 'requested',
        shop: workOrder.shop?.shopName || shop.shopName,
        service: serviceType,
        description,
      },
      workOrderId: workOrder.id,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating estimate request:', error);
    return NextResponse.json({ error: 'Failed to submit estimate request' }, { status: 500 });
  }
}