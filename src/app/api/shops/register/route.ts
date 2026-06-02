import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

export async function POST(request: Request) {
  try {

    const body = await request.json();
    
    const schema = z.object({
      shopName: z.string().min(2),
      ownerName: z.string().optional(),
      email: z.string().email(),
      phone: z.string().optional(),
      shopType: z.string().optional(),
      serviceLocation: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      dieselServices: z.array(z.string()).optional(),
      gasServices: z.array(z.string()).optional(),
      smallEngineServices: z.array(z.string()).optional(),
      heavyEquipmentServices: z.array(z.string()).optional(),
      resurfacingServices: z.array(z.string()).optional(),
      weldingServices: z.array(z.string()).optional(),
      tireServices: z.array(z.string()).optional(),
      mobileServiceRadius: z.number().optional(),
      emergencyService24_7: z.boolean().optional(),
      acceptedPaymentMethods: z.array(z.string()).optional(),
      couponCode: z.string().optional(),
    });
    const data = schema.parse(body);

    const existingOwnerShops = await prisma.shop.findMany({
      where: {
        email: data.email,
        status: { in: ['approved', 'pending'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingOwnerShops.length >= 20) {
      return NextResponse.json(
        { error: 'Shop limit reached for this owner email.' },
        { status: 403 }
      );
    }

    // Generate a temporary unique username for pending shops
    const tempUsername = `pending_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Create shop in database with pending status
    const newShop = await prisma.shop.create({
      data: {
        shopName: data.shopName,
        email: data.email,
        phone: data.phone || '',
        ownerName: data.ownerName || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        zipCode: data.zipCode || '',
        status: 'pending',
        profileComplete: false,
        username: tempUsername, // Temporary username until approved
        password: '', // Will be set during approval
      }
    });
    

    return NextResponse.json({
      success: true,
      shopId: newShop.id,
      checkoutUrl: null,
      message: 'Shop registration submitted. Awaiting admin approval.',
    });
  } catch (error) {
    console.error('[REGISTER] ERROR:', error);
    const details = process.env.NODE_ENV === 'development' ? String(error) : undefined;
    return NextResponse.json({ error: 'Registration failed', ...(details && { details }) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const allShops = await prisma.shop.findMany({
      where: {
        status: 'pending'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    return NextResponse.json(allShops);
  } catch (error) {
    console.error('Error fetching shops:', error);
    return NextResponse.json({ error: 'Failed to fetch shops' }, { status: 500 });
  }
}
