import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { validateCsrf } from '@/lib/csrf';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';
import { sendShopApprovedEmail } from '@/lib/emailService';

export async function GET(request: NextRequest) {
  // Require admin authentication to view pending shops
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Unauthorized - Admin access only' }, { status: 403 });
  }

  try {
    // Get all pending shops from the database
    const pendingShops = await prisma.shop.findMany({
      where: {
        status: 'pending'
      },
      orderBy: {
        createdAt: 'desc'
      },
    });

    // Format the response to match the expected frontend structure
    const formattedShops = pendingShops.map(shop => ({
      id: shop.id,
      name: shop.shopName,
      location: `${shop.city || ''}, ${shop.state || ''}`.trim(),
      address: shop.address,
      phone: shop.phone,
      email: shop.email,
      services: 0,
      submitted: shop.createdAt,
      status: shop.status,
      shopName: shop.shopName,
      ownerName: '', // Not stored separately in schema
      businessLicense: shop.businessLicense,
      insurancePolicy: shop.insurancePolicy,
      username: shop.username,
      // password: Removed for security - never send passwords/hashes to client
      zipCode: shop.zipCode,
      city: shop.city,
      state: shop.state,
    }));

    return NextResponse.json(formattedShops);
  } catch (error) {
    console.error('Error fetching pending shops:', error);
    return NextResponse.json({ error: 'Failed to fetch pending shops' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate public CSRF for unauthenticated registration
    // const ok = validatePublicCsrf(request);
    // if (!ok) return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });

    const body = await request.json();

    const schema = z.object({
      shopName: z.string().min(2),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email(),
      username: z.string().optional(),
      password: z.string().min(6).optional(),
      zipCode: z.string().optional(),
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

    // Hash password if provided
    let hashed = undefined;
    if (data.password) {
      hashed = await hashPassword(data.password);
    }

    // Generate a unique temp username to avoid unique constraint violations
    const tempUsername = data.username && data.username.trim()
      ? data.username.trim()
      : `pending_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create new shop in database with pending status
    const newShop = await prisma.shop.create({
      data: {
        shopName: data.shopName,
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        phone: data.phone || '',
        email: data.email,
        username: tempUsername,
        password: hashed || '',
        zipCode: data.zipCode || '',
        status: 'pending',
        profileComplete: false,
      }
    });

    // Format response
    const formattedShop = {
      id: newShop.id,
      name: newShop.shopName,
      location: `${newShop.city || ''}, ${newShop.state || ''}`.trim(),
      address: newShop.address,
      phone: newShop.phone,
      email: newShop.email,
      services: 0,
      submitted: newShop.createdAt,
      status: newShop.status,
      shopName: newShop.shopName,
      username: newShop.username,
      zipCode: newShop.zipCode,
    };

    return NextResponse.json({ 
      message: 'Shop registration submitted successfully',
      shop: formattedShop 
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error creating pending shop:', error);
    return NextResponse.json({ error: 'Failed to submit shop registration' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  
  const auth = requireAuth(request);
  
  if (auth instanceof NextResponse) {
    return auth;
  }
  
  
  try {
    if (!request.headers.get('authorization')) {
      const ok = await validateCsrf(request);
      if (!ok) return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
    }
    const body = await request.json();
    const { id, action } = body;

    // Find the shop in the database
    const shop = await prisma.shop.findUnique({
      where: { id }
    });

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    if (auth.role !== 'superadmin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    if (action === 'approve') {
      // When approving, ensure the shop has usable credentials so the owner
      // can immediately sign in. If username or password are missing we
      // generate them here and return the plaintext password to the admin
      // UI so it can be communicated to the shop owner.
      const shouldSetUsername = !shop.username || shop.username.startsWith('pending_');
      const newUsername = shouldSetUsername ? shop.email.split('@')[0] : shop.username;

      // Generate a human-friendly temporary password when none exists
      const { hashPassword, generateRandomToken } = await import('@/lib/auth');
      let plainPassword: string | null = null;
      let hashedPassword: string | undefined = undefined;

      if (!shop.password) {
        plainPassword = generateRandomToken(6); // 12 hex chars
        hashedPassword = await hashPassword(plainPassword);
      }

      const approvedShop = await prisma.shop.update({
        where: { id },
        data: {
          status: 'approved',
          approvedAt: new Date(),
          username: newUsername || shop.username,
          password: hashedPassword || shop.password,
        }
      });

      // Send approval email to shop owner
      sendShopApprovedEmail(
        approvedShop.email,
        approvedShop.shopName,
        approvedShop.username || newUsername,
        plainPassword
      ).catch(console.error);

      return NextResponse.json({ 
        message: 'Shop approved successfully', 
        shop: {
          id: approvedShop.id,
          shopName: approvedShop.shopName,
          email: approvedShop.email,
          status: approvedShop.status,
          username: approvedShop.username,
          tempPassword: plainPassword || null,
        }
      });
    } else if (action === 'deny') {
      // Update shop status to denied or delete it
      await prisma.shop.update({
        where: { id },
        data: {
          status: 'denied',
        }
      });
      
      return NextResponse.json({ message: 'Shop registration denied' });
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating shop status:', error);
    return NextResponse.json({ error: 'Failed to update shop status' }, { status: 500 });
  }
}
