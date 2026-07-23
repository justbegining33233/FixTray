import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';
import { sendEmail } from '@/lib/emailService';

/**
 * PUT /api/dvi/[id]/send-to-customer
 * Send DVI to customer for approval via email
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['shop', 'manager', 'admin', 'tech']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    // Get the DVI inspection
    const dvi = await prisma.dVIInspection.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!dvi) {
      return NextResponse.json(
        { error: 'DVI inspection not found' },
        { status: 404 }
      );
    }

    // Verify authorization
    if (auth.role === 'shop' && dvi.shopId !== auth.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (auth.role === 'manager' && dvi.shopId !== auth.shopId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get customer details
    if (!dvi.customerId) {
      return NextResponse.json(
        { error: 'Customer not associated with DVI' },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id: dvi.customerId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!customer || !customer.email) {
      return NextResponse.json(
        { error: 'Customer email not found' },
        { status: 400 }
      );
    }

    // Build approval link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app';
    const approvalLink = `${appUrl}/customer/dvi/${dvi.approvalToken}`;

    // Count urgent items
    const urgentCount = dvi.items.filter((i) => i.condition === 'red').length;
    const advisoryCount = dvi.items.filter((i) => i.condition === 'yellow').length;
    const totalCost = dvi.items
      .filter((i) => i.condition !== 'green' && i.estimatedCost)
      .reduce((sum, i) => sum + (i.estimatedCost || 0), 0);

    // Send email to customer
    const emailBody = `
      <h2>Vehicle Inspection Report Ready for Your Review</h2>
      <p>Hi ${customer.firstName || 'there'},</p>
      <p>Your vehicle inspection is complete. Please review the findings and approve the recommended services.</p>
      
      <h3>Inspection Summary</h3>
      <ul>
        <li><strong>Vehicle:</strong> ${dvi.vehicleDesc || 'N/A'}</li>
        <li><strong>Mileage:</strong> ${dvi.mileage ? dvi.mileage.toLocaleString() : 'N/A'} miles</li>
        <li><strong>Urgent Issues:</strong> ${urgentCount}</li>
        <li><strong>Items Needing Attention:</strong> ${advisoryCount}</li>
        ${totalCost > 0 ? `<li><strong>Estimated Repair Cost:</strong> $${totalCost.toFixed(2)}</li>` : ''}
      </ul>
      
      <p>
        <a href="${approvalLink}" style="background-color: #22c55e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; margin: 20px 0;">
          Review Inspection & Approve Services
        </a>
      </p>
      
      <p>This link will expire in 30 days. If you have any questions, please contact the shop directly.</p>
    `;

    await sendEmail({
      to: customer.email,
      subject: `Vehicle Inspection Ready for Review - ${dvi.vehicleDesc || 'Your Vehicle'}`,
      html: emailBody,
    });

    // Update DVI status
    const updated = await prisma.dVIInspection.update({
      where: { id },
      data: {
        status: 'sent',
        updatedAt: new Date(),
      },
      include: { items: true },
    });

    // Block work order from progressing until approved
    if (dvi.workOrderId) {
      await prisma.workOrder.update({
        where: { id: dvi.workOrderId },
        data: {
          status: 'awaiting-customer-approval',
        },
      });
    }

    logger.info('DVI sent to customer for approval', {
      dviId: id,
      customerId: dvi.customerId,
      customerEmail: customer.email,
    });

    return NextResponse.json({
      success: true,
      message: 'DVI inspection sent to customer email',
      inspection: updated,
      approvalLink,
    });
  } catch (error) {
    logger.error('Error sending DVI to customer', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to send DVI to customer' },
      { status: 500 }
    );
  }
}

