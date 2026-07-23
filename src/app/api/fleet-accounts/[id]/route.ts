import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const fleetAccountUpdateSchema = z.object({
  companyName: z.string().min(1).optional(),
  contactName: z.string().min(1).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  billingAddress: z.string().optional(),
  taxId: z.string().optional(),
  netTerms: z.number().int().min(0).optional(),
  creditLimit: z.number().min(0).optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const fleetAccount = await prisma.fleetAccount.findUnique({
      where: { id },
      include: {
        vehicles: { orderBy: { createdAt: 'desc' } },
        invoices: { orderBy: { createdAt: 'desc' } },
        Shop: { select: { id: true, shopName: true } },
      },
    });

    if (!fleetAccount) {
      return NextResponse.json(
        { error: 'Fleet account not found' },
        { status: 404 }
      );
    }

    logger.debug('Fleet account retrieved', { id });

    return NextResponse.json(fleetAccount);
  } catch (error) {
    logger.error('Failed to fetch fleet account', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch fleet account' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validated = fleetAccountUpdateSchema.parse(body);

    // Verify account exists
    const existing = await prisma.fleetAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Fleet account not found' },
        { status: 404 }
      );
    }

    // Update fleet account
    const updated = await prisma.fleetAccount.update({
      where: { id },
      data: validated,
      include: {
        vehicles: true,
        invoices: true,
      },
    });

    logger.info('Fleet account updated', { id });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Failed to update fleet account', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to update fleet account' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['shop_owner', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    // Verify account exists
    const existing = await prisma.fleetAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Fleet account not found' },
        { status: 404 }
      );
    }

    // Delete associated vehicles and invoices (cascade)
    await prisma.fleetAccount.delete({ where: { id } });

    logger.info('Fleet account deleted', { id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete fleet account', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to delete fleet account' },
      { status: 500 }
    );
  }
}
