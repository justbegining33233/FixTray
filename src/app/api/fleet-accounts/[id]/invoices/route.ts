import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const invoiceSchema = z.object({
  workOrderIds: z.array(z.string()).min(1, 'At least one work order required'),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { id: fleetAccountId } = await params;

    // Verify fleet account exists
    const fleetAccount = await prisma.fleetAccount.findUnique({
      where: { id: fleetAccountId },
    });

    if (!fleetAccount) {
      return NextResponse.json(
        { error: 'Fleet account not found' },
        { status: 404 }
      );
    }

    // Get invoices for this fleet
    const invoices = await prisma.fleetInvoice.findMany({
      where: { fleetAccountId },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate statistics
    const stats = {
      totalInvoices: invoices.length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      amountPaid: invoices.reduce((sum, inv) => sum + inv.amountPaid, 0),
      amountPending: invoices.reduce((sum, inv) => {
        return inv.status === 'unpaid' ? sum + (inv.totalAmount - inv.amountPaid) : sum;
      }, 0),
    };

    logger.debug('Fleet invoices retrieved', { fleetAccountId, count: invoices.length });

    return NextResponse.json({
      invoices,
      stats,
    });
  } catch (error) {
    logger.error('Failed to fetch fleet invoices', error);
    return NextResponse.json(
      { error: 'Failed to fetch fleet invoices' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['shop_owner', 'manager', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { id: fleetAccountId } = await params;
    const body = await request.json();

    // Verify fleet account exists
    const fleetAccount = await prisma.fleetAccount.findUnique({
      where: { id: fleetAccountId },
      include: { Shop: true },
    });

    if (!fleetAccount) {
      return NextResponse.json(
        { error: 'Fleet account not found' },
        { status: 404 }
      );
    }

    // Validate input
    const validated = invoiceSchema.parse(body);

    // Get work orders for this fleet to calculate total
    const workOrders = await prisma.workOrder.findMany({
      where: {
        id: { in: validated.workOrderIds },
        shopId: fleetAccount.shopId,
      },
    });

    if (workOrders.length === 0) {
      return NextResponse.json(
        { error: 'No valid work orders found' },
        { status: 400 }
      );
    }

    const totalAmount = workOrders.reduce((sum, wo) => sum + (wo.estimatedCost || wo.amountPaid || 0), 0);

    // Generate invoice number
    const invoiceCount = await prisma.fleetInvoice.count({
      where: { fleetAccountId },
    });
    const invoiceNumber = `FLEET-${fleetAccountId.slice(-8).toUpperCase()}-${String(invoiceCount + 1).padStart(4, '0')}`;

    // Create invoice
    const invoice = await prisma.fleetInvoice.create({
      data: {
        fleetAccountId,
        shopId: fleetAccount.shopId,
        invoiceNumber,
        workOrderIds: validated.workOrderIds.join(','),
        totalAmount,
        dueDate: validated.dueDate ? new Date(validated.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        notes: validated.notes,
      },
    });

    logger.info('Fleet invoice created', {
      fleetAccountId,
      invoiceId: invoice.id,
      invoiceNumber,
      totalAmount,
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Failed to create fleet invoice', error);
    return NextResponse.json(
      { error: 'Failed to create fleet invoice' },
      { status: 500 }
    );
  }
}
