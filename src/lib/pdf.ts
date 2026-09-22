import jsPDF from 'jspdf';
import { WorkOrder } from '@/types/workorder';
import { FIXTRAY_SERVICE_FEE } from '@/lib/constants';

export function generateInvoicePDF(workOrder: WorkOrder, serviceFeeUsd: number = FIXTRAY_SERVICE_FEE) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('INVOICE', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Work Order: ${workOrder.id}`, 20, 35);
  doc.text(`Date: ${new Date(workOrder.createdAt).toLocaleDateString()}`, 20, 40);
  doc.text(`Status: ${workOrder.status.toUpperCase()}`, 20, 45);
  
  // Shop Info
  doc.setFontSize(12);
  doc.text('Shop Information:', 20, 60);
  doc.setFontSize(10);
  doc.text(workOrder.shop?.shopName || 'Shop Name Not Available', 20, 67);
  doc.text(workOrder.shop?.phone || 'Phone Not Available', 20, 72);
  doc.text(workOrder.shop?.email || 'Email Not Available', 20, 77);
  
  // Customer Info
  doc.setFontSize(12);
  doc.text('Customer Information:', 120, 60);
  doc.setFontSize(10);
  doc.text(workOrder.customer ? `${workOrder.customer.firstName} ${workOrder.customer.lastName}` : 'Customer Name Not Available', 120, 67);
  doc.text(workOrder.customer?.email || 'Email Not Available', 120, 72);
  if (workOrder.customer?.phone) {
    doc.text(workOrder.customer.phone, 120, 77);
  }
  
  // Vehicle Info
  doc.setFontSize(12);
  doc.text('Vehicle Information:', 20, 95);
  doc.setFontSize(10);
  doc.text(`Type: ${workOrder.vehicleType}`, 20, 102);
  doc.text(`Service Location: ${workOrder.serviceLocationType || 'Not specified'}`, 20, 107);
  
  // Line items
  let y = 125;
  doc.setFontSize(12);
  doc.text('Services & Parts:', 20, y);
  y += 10;
  
  doc.setFontSize(10);
  doc.line(20, y, 190, y);
  y += 7;
  doc.text('Description', 25, y);
  doc.text('Qty', 140, y);
  doc.text('Price', 160, y);
  doc.text('Total', 180, y, { align: 'right' });
  y += 3;
  doc.line(20, y, 190, y);
  y += 7;
  
  // Add line items from estimate
  if (workOrder.estimate?.lineItems) {
    for (const item of workOrder.estimate.lineItems) {
      doc.text(item.description, 25, y);
      doc.text(item.quantity.toString(), 140, y);
      doc.text(`$${item.unitPrice.toFixed(2)}`, 160, y);
      doc.text(`$${item.total.toFixed(2)}`, 180, y, { align: 'right' });
      y += 7;
    }
  }
  
  // Totals
  y += 5;
  doc.line(140, y, 190, y);
  y += 7;
  
  const subtotal = workOrder.estimate?.amount || 0;
  const serviceFee = Math.max(0, Number(serviceFeeUsd) || 0);
  const totalDue = subtotal + serviceFee;
  
  doc.text('Subtotal:', 140, y);
  doc.text(`$${subtotal.toFixed(2)}`, 180, y, { align: 'right' });
  y += 7;
  
  doc.setTextColor(150, 150, 150);
  doc.text('FixTray Service Fee:', 140, y);
  doc.text(`$${serviceFee.toFixed(2)}`, 180, y, { align: 'right' });
  y += 7;
  doc.setTextColor(0, 0, 0);
  
  doc.line(140, y, 190, y);
  y += 7;
  doc.setFontSize(11);
  doc.text('Total Due:', 140, y);
  doc.text(`$${totalDue.toFixed(2)}`, 180, y, { align: 'right' });
  doc.setFontSize(10);
  y += 3;
  doc.line(140, y, 190, y);
  
  // Payment status
  y += 10;
  doc.setFontSize(10);
  const totalPaid = workOrder.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
  if (totalPaid >= totalDue && totalDue > 0) {
    doc.text('PAID', 140, y);
    doc.text(`Amount Paid: $${totalPaid.toFixed(2)}`, 140, y + 7);
  } else {
    doc.text('PAYMENT PENDING', 140, y);
    if (totalPaid > 0) {
      doc.text(`Amount Paid: $${totalPaid.toFixed(2)}`, 140, y + 7);
    }
  }
  
  // Footer
  doc.setFontSize(8);
  doc.text('Thank you for your business!', 105, 280, { align: 'center' });
  
  return doc;
}

export function generateInvoiceBuffer(workOrder: WorkOrder, serviceFeeUsd?: number): Buffer {
  const doc = generateInvoicePDF(workOrder, serviceFeeUsd);
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}
