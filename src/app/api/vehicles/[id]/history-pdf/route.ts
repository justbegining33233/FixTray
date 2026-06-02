import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import jsPDF from 'jspdf';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    // Auth check: customer owns vehicle, or shop has serviced it
    const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
    const isOwner = auth.role === 'customer' && vehicle.customerId === auth.id;
    const isShop = shopId && await prisma.workOrder.findFirst({
      where: { vehicleId: id, shopId },
    });

    if (!isOwner && !isShop && (auth.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all work orders for this vehicle
    const workOrders = await prisma.workOrder.findMany({
      where: { vehicleId: id },
      include: {
        shop: { select: { shopName: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Generate PDF
    const doc = new jsPDF();
    const customerName = vehicle.customer
      ? `${vehicle.customer.firstName} ${vehicle.customer.lastName}`
      : 'Unknown';

    // Header
    doc.setFontSize(20);
    doc.text('VEHICLE SERVICE HISTORY', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 27, { align: 'center' });

    // Vehicle Info
    doc.setFontSize(14);
    doc.text('Vehicle Information', 20, 42);
    doc.setFontSize(10);
    doc.text(`${vehicle.year} ${vehicle.make} ${vehicle.model}`, 20, 50);
    doc.text(`License Plate: ${vehicle.licensePlate || 'N/A'}`, 20, 56);
    doc.text(`VIN: ${vehicle.vin || 'N/A'}`, 20, 62);

    // Owner Info
    doc.setFontSize(14);
    doc.text('Owner', 120, 42);
    doc.setFontSize(10);
    doc.text(customerName, 120, 50);
    if (vehicle.customer?.email) doc.text(vehicle.customer.email, 120, 56);
    if (vehicle.customer?.phone) doc.text(vehicle.customer.phone, 120, 62);

    // Service History
    doc.setLineWidth(0.5);
    doc.line(20, 78, 190, 78);

    doc.setFontSize(14);
    doc.text('Service History', 20, 88);

    let y = 96;

    if (workOrders.length === 0) {
      doc.setFontSize(10);
      doc.text('No service history found.', 20, y);
    } else {
      for (const wo of workOrders) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${new Date(wo.createdAt).toLocaleDateString()} — ${wo.shop?.shopName || 'Unknown Shop'}`, 20, y);
        y += 6;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`WO: ${wo.id.slice(0, 8)} | Status: ${wo.status} | Tech: ${wo.assignedTo ? `${wo.assignedTo.firstName} ${wo.assignedTo.lastName}` : 'Unassigned'}`, 20, y);
        y += 5;

        doc.text(`Vehicle Type: ${wo.vehicleType}`, 20, y);
        y += 5;

        // Amount
        const amount = wo.amountPaid || wo.estimatedCost || 0;
        if (amount > 0) {
          doc.text(`Amount: $${amount.toFixed(2)}`, 20, y);
          y += 5;
        }

        // Parts used
        const parts = (wo.partsUsed as any[]) || [];
        if (parts.length > 0) {
          doc.text(`Parts: ${parts.map((p: any) => p.name || p.partName).join(', ')}`, 20, y);
          y += 5;
        }

        doc.setLineWidth(0.2);
        doc.setDrawColor(200);
        doc.line(20, y + 1, 190, y + 1);
        y += 7;
      }
    }

    // Footer with totals
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    y += 5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const totalSpent = workOrders.reduce((sum, wo) => sum + (wo.amountPaid || 0), 0);
    doc.text(`Total Services: ${workOrders.length}`, 20, y);
    y += 6;
    doc.text(`Total Spent: $${totalSpent.toFixed(2)}`, 20, y);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="vehicle-history-${vehicle.make}-${vehicle.model}-${vehicle.year}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating vehicle history PDF:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
