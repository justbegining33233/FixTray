import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { rateLimit, rateLimitConfigs } from '@/lib/rateLimit';
import { validateRequest, inventoryUpdateSchema } from '@/lib/validation';
import { sanitizeObject } from '@/lib/sanitize';

// GET - Get single inventory item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(rateLimitConfigs.api)(request);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = requireRole(request, ['shop', 'manager', 'tech']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Verify access
    const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
    if (item.shopId !== shopId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory item' },
      { status: 500 }
    );
  }
}

// PUT - Update inventory item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(rateLimitConfigs.api)(request);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = requireRole(request, ['shop', 'manager', 'tech']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();
    const sanitizedBody = sanitizeObject(body);

    const validation = await validateRequest(inventoryUpdateSchema, sanitizedBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors.issues },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Check if item exists
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Verify ownership
    const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
    if (item.shopId !== shopId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update item
    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        type: data.type,
        name: data.name,
        sku: data.sku,
        quantity: data.quantity,
        price: data.price,
        reorderPoint: data.reorderPoint,
        // notes: data.notes,
      },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    return NextResponse.json(
      { error: 'Failed to update inventory item' },
      { status: 500 }
    );
  }
}

// DELETE - Delete inventory item
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
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Verify ownership
    const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
    if (item.shopId !== shopId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete item
    await prisma.inventoryItem.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    return NextResponse.json(
      { error: 'Failed to delete inventory item' },
      { status: 500 }
    );
  }
}

