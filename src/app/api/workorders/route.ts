import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { validateCsrf } from '@/lib/csrf';
import { sendWorkOrderCreatedEmail } from '@/lib/emailService';
import { rateLimit, rateLimitConfigs } from '@/lib/rateLimit';
import { sanitizeObject } from '@/lib/sanitize';
// Enterprise features
import { apiVersioning } from '@/lib/apiVersioning';
import { queryCache } from '@/lib/queryCache';
import { compression } from '@/lib/compression';
import { featureFlags } from '@/lib/featureFlags';
import logger from '@/lib/logger';
import { extractServiceNames, findUnconfiguredShopServices } from '@/lib/shopServiceValidation';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // API Versioning
    const version = apiVersioning.getVersionFromRequest(request);
    if (!apiVersioning.isVersionSupported(version)) {
      return NextResponse.json({
        error: 'API version not supported',
        supportedVersions: apiVersioning.getSupportedVersions()
      }, {
        status: 400,
        headers: { 'X-API-Version': version }
      });
    }

    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Feature flag check
    const advancedFiltering = await featureFlags.isEnabled('advanced_filtering', {
      userId: auth.id,
      role: auth.role
    });

    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page') || '1';
    const limitParam = searchParams.get('limit') || '20';
    const page = parseInt(pageParam);
    const limit = parseInt(limitParam);

    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: 'Invalid page parameter' }, { status: 400 });
    }
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: 'Invalid limit parameter (1-100)' }, { status: 400 });
    }

    const status = searchParams.get('status');
    const shopId = searchParams.get('shopId');
    const customerId = searchParams.get('customerId');
    const search = searchParams.get('search');
    const ALLOWED_SORT_FIELDS = ['createdAt', 'updatedAt', 'status', 'priority', 'dueDate'] as const;
    const sortByRaw = searchParams.get('sortBy') || 'createdAt';
    const sortBy: string = (ALLOWED_SORT_FIELDS as readonly string[]).includes(sortByRaw) ? sortByRaw : 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Build cache key
    const cacheKey = `workorders:${auth.id}:${auth.role}:${page}:${limit}:${status}:${shopId}:${customerId}:${search}:${sortBy}:${sortOrder}`;

    // Skip cache for live ops queries (pending / active status filters) so the
    // shop ops board reflects new customer-created work orders immediately.
    const isOpsQuery = !!status;
    if (!isOpsQuery) {
      const cachedResult = await queryCache.get(cacheKey);
      if (cachedResult) {
        logger.debug('Serving work orders from cache', { cacheKey, userId: auth.id });
        const response = NextResponse.json(cachedResult);
        compression.addCompressionHeaders(response);
        return response;
      }
    }

    // Build where clause
    const where: any = {};

    // Role-based filtering
    if (auth.role === 'customer') {
      where.customerId = auth.id;
    } else if (auth.role === 'tech' || auth.role === 'manager') {
      where.shopId = auth.shopId;
    } else if (auth.role === 'shop') {
      where.shopId = auth.id;
    }

    // Additional filters — support single value or comma-separated list
    if (status) {
      const statuses = status.split(',').map((s) => s.trim()).filter(Boolean);
      where.status = statuses.length > 1 ? { in: statuses } : statuses[0];
    }
    if (shopId && (auth.role === 'superadmin' || auth.role === 'customer')) {
      where.shopId = shopId;
    }
    if (customerId && (auth.role === 'superadmin' || auth.role === 'shop' || auth.role === 'manager')) {
      where.customerId = customerId;
    }
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { issueDescription: { contains: search, mode: 'insensitive' } },
        { vehicleType: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Advanced filtering (if feature flag enabled)
    if (advancedFiltering) {
      const priority = searchParams.get('priority');
      const dateFrom = searchParams.get('dateFrom');
      const dateTo = searchParams.get('dateTo');

      if (priority) where.priority = priority;
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) where.createdAt.lte = new Date(dateTo);
      }
    }

    // Get total count
    const total = await prisma.workOrder.count({ where });

    // Get paginated results
    const rawWorkOrders = await prisma.workOrder.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        shop: {
          select: {
            id: true,
            shopName: true,
            phone: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
            vin: true,
            licensePlate: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Fields (repairs, maintenance, partsMaterials, pictures, location, estimate,
    // techLabor, partsUsed, workPhotos, completion) are now Prisma Json? — returned
    // as native JS objects/arrays, no JSON.parse needed.
    const workOrders = rawWorkOrders.map(wo => ({
      ...wo,
      services: wo.repairs || wo.maintenance ? {
        repairs: wo.repairs ?? undefined,
        maintenance: wo.maintenance ?? undefined,
      } : undefined,
      partsMaterials: wo.partsMaterials ?? undefined,
      issueDescription: {
        symptoms: wo.issueDescription,
        pictures: (wo.pictures as string[] | null) ?? [],
      },
      location: wo.location ?? undefined,
      estimate: wo.estimate ?? undefined,
      techLabor: wo.techLabor ?? undefined,
      partsUsed: wo.partsUsed ?? undefined,
      workPhotos: (wo.workPhotos as unknown[] | null) ?? [],
      completion: wo.completion ?? undefined,
      vehicle: wo.vehicle ?? undefined,
    }));

    const result = {
      workOrders,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };

    // Cache the result — skip for live ops queries
    if (!isOpsQuery) {
      await queryCache.set(cacheKey, result, undefined, 300); // Cache for 5 minutes
    }

    // Log performance metrics
    const duration = Date.now() - startTime;
    logger.performance('Work orders fetch completed', duration, {
      userId: auth.id,
      role: auth.role,
      resultCount: workOrders.length,
      cached: false
    });

    const response = NextResponse.json(result);
    compression.addCompressionHeaders(response);

    return response;

  } catch (error) {
    logger.error('Error fetching work orders', error, {
      userId: request.headers.get('x-user-id'),
      duration: Date.now() - startTime
    });

    return NextResponse.json({ error: 'Failed to fetch work orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const ALLOWED_CREATOR_ROLES = ['customer', 'shop', 'tech', 'manager', 'admin'];
  if (!ALLOWED_CREATOR_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: 'Unauthorized to create work orders' }, { status: 403 });
  }
  // If request uses cookie-based auth (no Authorization header), require CSRF
  if (!request.headers.get('authorization')) {
    const ok = await validateCsrf(request);
    if (!ok) return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const rateLimitResult = await rateLimit(rateLimitConfigs.api)(request);
  if (rateLimitResult) return rateLimitResult;

  try {
    const data = await request.json();
    const sanitizedData = sanitizeObject(data);

    let customerId: string;
    let shopId: string;

    if (auth.role === 'customer') {
      // Customer creating their own work order
      customerId = auth.id;
      shopId = sanitizedData.shopId;
    } else {
      // Shop / tech / manager / admin creating on behalf of a customer
      shopId = auth.role === 'shop' ? auth.id : (sanitizedData.shopId || auth.shopId);
      if (!shopId) {
        return NextResponse.json({ error: 'shopId is required' }, { status: 400 });
      }

      if (sanitizedData.customerId) {
        customerId = sanitizedData.customerId;
      } else if (sanitizedData.customerEmail) {
        const nameParts = (sanitizedData.customerName || 'Walk-in Customer').split(' ');
        const firstName = nameParts[0] || 'Walk-in';
        const lastName = nameParts.slice(1).join(' ') || 'Customer';
        const bcrypt = await import('bcrypt');
        const tempPassword = await bcrypt.hash(crypto.randomUUID(), 10);

        const customer = await prisma.customer.upsert({
          where: { email: sanitizedData.customerEmail },
          create: {
            email: sanitizedData.customerEmail,
            firstName,
            lastName,
            phone: sanitizedData.customerPhone || null,
            password: tempPassword,
          },
          update: {
            ...(sanitizedData.customerPhone ? { phone: sanitizedData.customerPhone } : {}),
          },
        });
        customerId = customer.id;
      } else {
        return NextResponse.json(
          { error: 'customerEmail is required when creating a work order on behalf of a customer' },
          { status: 400 }
        );
      }
    }

    if (!shopId) {
      return NextResponse.json({ error: 'shopId is required' }, { status: 400 });
    }

    const requestedServices = [
      ...extractServiceNames(sanitizedData.services?.repairs),
      ...extractServiceNames(sanitizedData.services?.maintenance),
      ...extractServiceNames(sanitizedData.serviceType),
    ];

    const serviceValidation = await findUnconfiguredShopServices(shopId, requestedServices);
    if (!serviceValidation.hasConfiguredServices) {
      return NextResponse.json(
        {
          error: 'This shop has no services configured. Ask the shop admin to add services before creating work orders.',
        },
        { status: 400 }
      );
    }

    if (serviceValidation.invalidServices.length > 0) {
      return NextResponse.json(
        {
          error: 'One or more requested services are not offered by this shop.',
          invalidServices: serviceValidation.invalidServices,
        },
        { status: 400 }
      );
    }

    const workOrder = await prisma.workOrder.create({
      data: {
        customerId,
        shopId,
        vehicleType: sanitizedData.vehicleType || 'personal-vehicle',
        serviceLocation: sanitizedData.serviceLocationType || sanitizedData.serviceLocation || 'in-shop',
        repairs: sanitizedData.services?.repairs || [],
        maintenance: sanitizedData.services?.maintenance || [],
        estimatedCost: typeof sanitizedData.estimatedCost === 'number' ? sanitizedData.estimatedCost : null,
        techLabor: sanitizedData.techLabor || undefined,
        partsMaterials: sanitizedData.partsMaterials,
        issueDescription: sanitizedData.issueDescription,
        pictures: sanitizedData.issueDescription?.pictures || [],
        vinPhoto: sanitizedData.vinPhoto,
        location: sanitizedData.vehicleLocation,
        status: 'pending',
      },
      include: {
        customer: true,
        shop: true,
      },
    });

    // Send email notification
    sendWorkOrderCreatedEmail(workOrder.customer.email, workOrder.id).catch(console.error);

    // Create notification
    await prisma.notification.create({
      data: {
        customerId,
        type: 'workorder',
        title: 'Work Order Created',
        message: `Your work order ${workOrder.id} has been created successfully`,
        workOrderId: workOrder.id,
        deliveryMethod: 'in-app',
      },
    });

    return NextResponse.json(workOrder, { status: 201 });
  } catch (error) {
    console.error('Error creating work order:', error);
    return NextResponse.json({ error: 'Failed to create work order' }, { status: 500 });
  }
}


