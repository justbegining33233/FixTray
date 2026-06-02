import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// GET - List all inventory items with optional low stock filter
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

    const lowStockOnly = searchParams.get('lowStockOnly') === 'true';

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
    }

    // Verify user has access to this shop
    if (decoded.role === 'shop') {
      // For shop owners, verify they own this shop
      if (decoded.id !== shopId) {
        return NextResponse.json({ error: 'Access denied to this shop' }, { status: 403 });
      }
    } else if (decoded.role === 'manager' || decoded.role === 'tech') {
      // For managers and techs, verify they belong to this shop
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
      // Reject any other roles
      return NextResponse.json({ error: 'Unauthorized - Shop access only' }, { status: 403 });
    }

    const where: any = { shopId };
    
    if (lowStockOnly) {
      // Get items where quantity is below reorder point
      where.quantity = { lte: prisma.inventoryStock.fields.reorderPoint };
    }

    const items = await prisma.inventoryStock.findMany({
      where,
      orderBy: [
        { quantity: 'asc' }, // Show low stock first
        { itemName: 'asc' },
      ],
    });

    const lowStockCount = await prisma.inventoryStock.count({
      where: {
        shopId,
        quantity: { lte: prisma.inventoryStock.fields.reorderPoint },
      },
    });

    return NextResponse.json({ items, lowStockCount });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

// POST - Add new inventory item
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
    
    const body = await request.json();
    const {
      shopId,
      itemName,
      sku,
      category,
      quantity,
      unitCost,
      sellingPrice,
      reorderPoint,
      reorderQuantity,
      supplier,
      supplierSKU,
      location,
      notes,
    } = body;

    if (!shopId || !itemName) {
      return NextResponse.json({ error: 'Shop ID and item name required' }, { status: 400 });
    }

    // Verify user has access to this shop
    if (decoded.role === 'shop') {
      // For shop owners, verify they own this shop
      if (decoded.id !== shopId) {
        return NextResponse.json({ error: 'Access denied to this shop' }, { status: 403 });
      }
    } else if (decoded.role === 'manager') {
      // For managers, verify they belong to this shop
      const manager = await prisma.tech.findFirst({
        where: {
          id: decoded.id,
          shopId: shopId,
          role: 'manager',
        },
      });
      
      if (!manager) {
        return NextResponse.json({ error: 'Access denied to this shop' }, { status: 403 });
      }
    } else {
      // Reject any other roles
      return NextResponse.json({ error: 'Unauthorized - Shop admin or manager only' }, { status: 403 });
    }

    // Get shop settings for markup calculation
    const shopSettings = await prisma.shopSettings.findUnique({
      where: { shopId },
      select: { inventoryMarkup: true },
    });

    const markup = shopSettings?.inventoryMarkup || 0.30; // Default 30% markup
    const calculatedSellingPrice = unitCost ? unitCost * (1 + markup) : (sellingPrice || 0);

    const item = await prisma.inventoryStock.create({
      data: {
        shopId,
        itemName,
        sku,
        category,
        quantity: quantity || 0,
        unitCost: unitCost || 0,
        sellingPrice: sellingPrice || calculatedSellingPrice, // Use provided selling price or calculate from markup
        reorderPoint: reorderPoint || 10,
        reorderQuantity: reorderQuantity || 50,
        supplier,
        supplierSKU,
        location,
        notes,
        lastRestocked: new Date(),
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    return NextResponse.json({ error: 'Failed to create inventory item' }, { status: 500 });
  }
}

// PUT - Update inventory quantity (restock or usage)
export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const body = await request.json();
    const { id, _shopId, action, quantity, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
    }

    // Get the item to verify shop ownership
    const existingItem = await prisma.inventoryStock.findUnique({
      where: { id },
      select: { shopId: true, quantity: true },
    });

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Verify user has access to this shop
    if (decoded.role === 'shop') {
      // For shop owners, verify they own this shop
      if (decoded.id !== existingItem.shopId) {
        return NextResponse.json({ error: 'Access denied to this shop' }, { status: 403 });
      }
    } else if (decoded.role === 'manager') {
      // For managers, verify they belong to this shop
      const manager = await prisma.tech.findFirst({
        where: {
          id: decoded.id,
          shopId: existingItem.shopId,
          role: 'manager',
        },
      });
      
      if (!manager) {
        return NextResponse.json({ error: 'Access denied to this shop' }, { status: 403 });
      }
    } else {
      // Reject any other roles
      return NextResponse.json({ error: 'Unauthorized - Shop admin or manager only' }, { status: 403 });
    }

    const updateData: any = updates;

    // If unitCost is being updated, recalculate selling price based on markup
    if (updates.unitCost !== undefined) {
      const shopSettings = await prisma.shopSettings.findUnique({
        where: { shopId: existingItem.shopId },
        select: { inventoryMarkup: true },
      });
      
      const markup = shopSettings?.inventoryMarkup || 0.30; // Default 30% markup
      updateData.sellingPrice = updates.unitCost * (1 + markup);
    }

    // Handle quantity adjustments
    if (action === 'add') {
      updateData.quantity = existingItem.quantity + (quantity || 0);
      updateData.lastRestocked = new Date();
    } else if (action === 'subtract') {
      updateData.quantity = Math.max(0, existingItem.quantity - (quantity || 0));
    }

    const item = await prisma.inventoryStock.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 });
  }
}
