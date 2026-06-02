import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { generateInvoicePDF } from '@/lib/pdf';
import { sendEmail } from '@/lib/emailService';

export async function POST(
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

    // Only shop/tech/manager can email invoices
    const authorized =
      (auth.role === 'superadmin') ||
      (auth.role === 'shop' && workOrder.shopId === auth.id) ||
      ((auth.role === 'tech' || auth.role === 'manager') && workOrder.shopId === auth.shopId);

    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!workOrder.customer?.email) {
      return NextResponse.json({ error: 'Customer has no email address' }, { status: 400 });
    }

    // Generate PDF
    const pdf = generateInvoicePDF(workOrder as any);
    const _pdfBuffer = Buffer.from(pdf.output('arraybuffer'));

    const shopName = workOrder.shop?.shopName || 'Your Auto Shop';
    const customerName = workOrder.customer
      ? `${workOrder.customer.firstName} ${workOrder.customer.lastName}`
      : 'Valued Customer';

    // Calculate totals from work order data
    const parts = (workOrder.partsUsed as any[]) || [];
    const labor = (workOrder.techLabor as any[]) || [];
    const charges = (workOrder.partsMaterials as any[]) || [];
    const partsTotal = parts.reduce((sum: number, p: any) => sum + (p.quantity || 1) * (p.unitPrice || 0), 0);
    const laborTotal = labor.reduce((sum: number, l: any) => sum + (l.hours || 0) * (l.ratePerHour || 0), 0);
    const chargesTotal = charges.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
    const subtotal = partsTotal + laborTotal + chargesTotal;
    const totalDue = subtotal + 5; // FixTray service fee

    // Send email with invoice details
    const sent = await sendEmail({
      to: workOrder.customer.email,
      subject: `Invoice from ${shopName} — Work Order ${id.slice(0, 8)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e5332a;">Invoice from ${shopName}</h2>
          <p>Hi ${customerName},</p>
          <p>Here is the invoice for your recent service:</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Work Order:</strong> ${id.slice(0, 8)}</p>
            <p><strong>Date:</strong> ${new Date(workOrder.createdAt).toLocaleDateString()}</p>
            <p><strong>Vehicle:</strong> ${workOrder.vehicleType || 'N/A'}</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 12px 0;"/>
            <p><strong>Parts & Materials:</strong> $${partsTotal.toFixed(2)}</p>
            <p><strong>Labor:</strong> $${laborTotal.toFixed(2)}</p>
            ${chargesTotal > 0 ? `<p><strong>Additional Charges:</strong> $${chargesTotal.toFixed(2)}</p>` : ''}
            <p><strong>Service Fee:</strong> $5.00</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 12px 0;"/>
            <p style="font-size: 18px; font-weight: bold; color: #22c55e;">Total Due: $${totalDue.toFixed(2)}</p>
          </div>
          <p>To view and download the full invoice PDF, please log in to your account.</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app'}/customer/workorders/${id}" 
             style="display: inline-block; background: #e5332a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
            View Work Order
          </a>
          <p style="color: #888; margin-top: 20px; font-size: 12px;">Thank you for choosing ${shopName}!</p>
        </div>
      `,
    });

    if (!sent) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Invoice emailed to customer' });
  } catch (error) {
    console.error('Error emailing invoice:', error);
    return NextResponse.json({ error: 'Failed to email invoice' }, { status: 500 });
  }
}
