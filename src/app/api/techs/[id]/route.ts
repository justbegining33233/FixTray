import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// GET - Fetch a specific tech by ID
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const tech = await prisma.tech.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        available: true,
        shopId: true,
        hourlyRate: true,
        createdAt: true,
        updatedAt: true,
        assignedWorkOrders: {
          select: { id: true, status: true },
        },
        _count: {
          select: { assignedWorkOrders: true },
        },
      },
    });

    if (!tech) {
      return NextResponse.json({ error: 'Tech not found' }, { status: 404 });
    }

    // Scope: must belong to caller's shop (admins exempt)
    if (decoded.role !== 'superadmin') {
      const callerShopId = decoded.role === 'shop' ? decoded.id : decoded.shopId;
      if (!callerShopId || tech.shopId !== callerShopId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Never return hourlyRate to techs (salary data)
    const { hourlyRate: _hourlyRate, ...safeTech } = tech as typeof tech & { hourlyRate: number };
    const payload = (decoded.role === 'shop' || decoded.role === 'manager' || (decoded.role === 'superadmin'))
      ? tech
      : safeTech;

    return NextResponse.json({ tech: payload });
  } catch (error) {
    console.error('Error fetching tech:', error);
    return NextResponse.json({ error: 'Failed to fetch tech' }, { status: 500 });
  }
}

// PUT - Update a tech
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('PUT /api/techs/[id] - No auth header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      console.error('PUT /api/techs/[id] - Invalid token');
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Only shop admins can update techs
    if (decoded.role !== 'shop' && (decoded.role !== 'superadmin')) {
      console.error('PUT /api/techs/[id] - Forbidden, role:', decoded.role);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify the tech belongs to this shop (IDOR prevention)
    if (decoded.role !== 'superadmin') {
      const existingTech = await prisma.tech.findUnique({ where: { id: params.id }, select: { shopId: true } });
      if (!existingTech || existingTech.shopId !== decoded.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const body = await req.json();
    
    const { firstName, lastName, email, phone, hourlyRate, role, available } = body;

    // Build update data object
    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (hourlyRate !== undefined) updateData.hourlyRate = parseFloat(hourlyRate);
    if (role !== undefined) updateData.role = role;
    if (available !== undefined) updateData.available = available;

    const tech = await prisma.tech.update({
      where: { id: params.id },
      data: updateData,
      include: {
        assignedWorkOrders: {
          select: { id: true, status: true }
        }
      }
    });

    return NextResponse.json({ 
      message: 'Tech updated successfully',
      tech 
    });
  } catch (error: unknown) {
    console.error('PUT /api/techs/[id] - Error updating tech:', error);
    const details = process.env.NODE_ENV === 'development' ? (error as Error)?.message : undefined;
    return NextResponse.json({
      error: 'Failed to update tech',
      ...(details && { details }),
    }, { status: 500 });
  }
}

// DELETE - Delete a tech (optional, use with caution)
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Only shop admins can delete techs
    if (decoded.role !== 'shop' && (decoded.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify the tech belongs to this shop (IDOR prevention)
    if (decoded.role !== 'superadmin') {
      const existingTech = await prisma.tech.findUnique({ where: { id: params.id }, select: { shopId: true } });
      if (!existingTech || existingTech.shopId !== decoded.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Check if tech has active work orders
    const tech = await prisma.tech.findUnique({
      where: { id: params.id },
      include: {
        assignedWorkOrders: {
          where: {
            status: {
              in: ['pending', 'in_progress']
            }
          }
        }
      }
    });

    if (tech?.assignedWorkOrders && tech.assignedWorkOrders.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete tech with active work orders' 
      }, { status: 400 });
    }

    await prisma.tech.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ 
      message: 'Tech deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting tech:', error);
    return NextResponse.json({ error: 'Failed to delete tech' }, { status: 500 });
  }
}
