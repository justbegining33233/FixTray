import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';

// Fleet account validation schema
const fleetAccountSchema = z.object({
  companyName: z.string().min(1, 'Company name required'),
  contactName: z.string().min(1, 'Contact name required'),
  contactEmail: z.string().email('Valid email required'),
  contactPhone: z.string().optional(),
  billingAddress: z.string().optional(),
  taxId: z.string().optional(),
  netTerms: z.number().int().min(0).default(30),
  creditLimit: z.number().min(0).default(0),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
});

export async function GET(request: NextRequest) {
  try {
    // Verify shop owner/manager access
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    // Get shopId from auth context or query param
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');

    if (!shopId) {
      return NextResponse.json(
        { error: 'shopId required' },
        { status: 400 }
      );
    }

    // Fetch all fleet accounts for shop
    const accounts = await prisma.fleetAccount.findMany({
      where: { shopId },
      include: {
        vehicles: { select: { id: true } },
        invoices: { select: { id: true, status: true, totalAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.info('Fleet accounts retrieved', {
      shopId,
      count: accounts.length,
    });

    return NextResponse.json(accounts);
  } catch (error) {
    logger.error('Failed to fetch fleet accounts', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch fleet accounts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify shop owner/manager access
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');

    if (!shopId) {
      return NextResponse.json(
        { error: 'shopId required' },
        { status: 400 }
      );
    }

    // Validate input
    const validated = fleetAccountSchema.parse(body);

    // Create fleet account
    const fleetAccount = await prisma.fleetAccount.create({
      data: {
        ...validated,
        shopId,
      },
      include: {
        vehicles: true,
        invoices: true,
      },
    });

    logger.info('Fleet account created', {
      shopId,
      fleetAccountId: fleetAccount.id,
      companyName: fleetAccount.companyName,
    });

    return NextResponse.json(fleetAccount, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Failed to create fleet account', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to create fleet account' },
      { status: 500 }
    );
  }
}
