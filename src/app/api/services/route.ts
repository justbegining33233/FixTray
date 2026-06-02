import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { rateLimit, rateLimitConfigs } from '@/lib/rateLimit';
import { validateRequest, serviceCreateSchema } from '@/lib/validation';
import { sanitizeObject } from '@/lib/sanitize';

// GET - List all services for a shop
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimit(rateLimitConfigs.api)(request);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const auth = requireRole(request, ['shop', 'manager', 'tech', 'customer']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const category = searchParams.get('category');

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
    }

    const VALID_CATEGORIES = ['diesel', 'gas', 'small-engine', 'heavy-equipment', 'resurfacing', 'welding', 'tire'];

    // Build where clause
    const where: any = { shopId };
    if (category && VALID_CATEGORIES.includes(category)) {
      where.category = category;
    }

    const services = await prisma.shopService.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { serviceName: 'asc' },
      ],
    });

    return NextResponse.json({ services });
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}

// POST - Create a new service
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimit(rateLimitConfigs.api)(request);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication - only shop owners and managers
    const auth = requireRole(request, ['shop', 'manager']);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    
    // Sanitize input
    const sanitizedBody = sanitizeObject(body);

    // Validate input
    const validation = await validateRequest(serviceCreateSchema, sanitizedBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors.issues },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Verify shop ownership
    let shopId: string;
    if (auth.role === 'shop') {
      shopId = auth.id;
    } else if (auth.role === 'manager') {
      shopId = auth.shopId!;
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify shopId matches
    if (data.shopId !== shopId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check for duplicate service
    const existing = await prisma.shopService.findFirst({
      where: {
        shopId: data.shopId,
        serviceName: data.serviceName,
        category: data.category,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Service already exists with this name and category' },
        { status: 400 }
      );
    }

    // Create service
    const service = await prisma.shopService.create({
      data: {
        shopId: data.shopId,
        serviceName: data.serviceName,
        category: data.category,
        price: data.price || null,
        duration: data.duration || null,
        description: data.description || null,
      },
    });

    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    console.error('Error creating service:', error);
    return NextResponse.json(
      { error: 'Failed to create service' },
      { status: 500 }
    );
  }
}


