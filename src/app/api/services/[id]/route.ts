import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { rateLimit, rateLimitConfigs } from '@/lib/rateLimit';
import { validateRequest, serviceUpdateSchema } from '@/lib/validation';
import { sanitizeObject } from '@/lib/sanitize';

// GET - Get single service
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(rateLimitConfigs.api)(request);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = requireRole(request, ['shop', 'manager', 'tech', 'customer']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const service = await prisma.shopService.findUnique({
      where: { id },
    });

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    return NextResponse.json({ service });
  } catch (error) {
    console.error('Error fetching service:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service' },
      { status: 500 }
    );
  }
}

// PUT - Update service
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(rateLimitConfigs.api)(request);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = requireRole(request, ['shop', 'manager']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();
    const sanitizedBody = sanitizeObject(body);

    const validation = await validateRequest(serviceUpdateSchema, sanitizedBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors.issues },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Check if service exists and belongs to user's shop
    const service = await prisma.shopService.findUnique({
      where: { id },
    });

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Verify ownership
    const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
    if (service.shopId !== shopId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update service
    const updated = await prisma.shopService.update({
      where: { id },
      data: {
        serviceName: data.serviceName,
        category: data.category,
        price: data.price,
        duration: data.duration,
        description: data.description,
      },
    });

    return NextResponse.json({ service: updated });
  } catch (error) {
    console.error('Error updating service:', error);
    return NextResponse.json(
      { error: 'Failed to update service' },
      { status: 500 }
    );
  }
}

// DELETE - Delete service
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(rateLimitConfigs.api)(request);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = requireRole(request, ['shop', 'manager']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    // Check if service exists and belongs to user's shop
    const service = await prisma.shopService.findUnique({
      where: { id },
    });

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Verify ownership
    const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
    if (service.shopId !== shopId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete service
    await prisma.shopService.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting service:', error);
    return NextResponse.json(
      { error: 'Failed to delete service' },
      { status: 500 }
    );
  }
}

