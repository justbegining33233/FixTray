import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { generateInvoicePDF } from '@/lib/pdf';

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
    
    // Generate PDF - cast to WorkOrder type
    const pdf = generateInvoicePDF(workOrder as any);
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
