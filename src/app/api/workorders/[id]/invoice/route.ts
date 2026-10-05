import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import logger from '@/lib/logger';
import { generateInvoicePDF } from '@/lib/pdf';
import { getPlatformServiceFeeUsd } from '@/lib/platformFee';
import { frozenCustomerFeeUsd } from '@/lib/feeSnapshot';
import { quoteAmount } from '@/lib/workOrderCloseout';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  
  try {
    const { id } = await params;
    
    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        shop: true,
        assignedTo: true,
      },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }
    
    // Check authorization
    const authorized = 
      (auth.role === 'superadmin') ||
      (auth.role === 'customer' && workOrder.customerId === auth.id) ||
      (auth.role === 'shop' && workOrder.shopId === auth.id) ||
      ((auth.role === 'tech' || auth.role === 'manager') && workOrder.shopId === auth.shopId);
    
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const quote = quoteAmount(workOrder);
    const serviceFee = frozenCustomerFeeUsd(workOrder.completion, quote) ?? await getPlatformServiceFeeUsd();
    if (serviceFee == null) {
      return NextResponse.json({ error: 'The platform service fee is not configured.' }, { status: 409 });
    }
    const pdf = generateInvoicePDF(workOrder as any, serviceFee);
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${id}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json({ error: 'Failed to generate invoice' }, { status: 500 });
  }
}
