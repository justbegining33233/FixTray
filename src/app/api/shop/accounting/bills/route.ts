import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { booksAccess, shopIdForBooks } from '@/lib/books/access';
import { postBillPayment, postVendorBill } from '@/lib/books/journal';
import { saveJournalDraft } from '@/lib/books/persistJournal';
import { receiveInventory } from '@/lib/books/floor';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'accountant']);
  if (auth instanceof NextResponse) return auth;
  if (!booksAccess(auth.role).shopLedger) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const bills = await prisma.vendorBill.findMany({
    where: { shopId },
    include: { vendor: { select: { name: true } }, lines: true, payments: true },
    orderBy: { billDate: 'desc' },
  });
  const now = Date.now();
  return NextResponse.json({
    bills: bills.map((bill) => {
      const amount = bill.lines.reduce((sum, line) => sum + line.amountCents, 0);
      const paid = bill.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
      const open = Math.max(0, amount - paid);
      const ageDays = Math.floor((now - bill.billDate.getTime()) / 86400000);
      return {
        id: bill.id,
        vendor: bill.vendor.name,
        billDate: bill.billDate.toISOString(),
        dueDate: bill.dueDate.toISOString(),
        status: open === 0 ? 'paid' : 'unpaid',
        amountCents: amount,
        paidCents: paid,
        openCents: open,
        ageDays,
        bucket: ageDays <= 30 ? 'current' : ageDays <= 60 ? '30' : ageDays <= 90 ? '60' : '90',
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop']);
  if (auth instanceof NextResponse) return auth;
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const vendorId = String(body.vendorId || '');
  const qty = Math.round(Number(body.qty));
  const unitCostCents = Math.round(Number(body.unitCostCents));
  const inventoryItemId = body.inventoryItemId ? String(body.inventoryItemId) : null;
  if (!vendorId || qty <= 0 || unitCostCents < 0) {
    return NextResponse.json({ error: 'Vendor, quantity, and cost are required' }, { status: 400 });
  }
  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, shopId } });
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  const billDate = new Date(String(body.billDate || new Date().toISOString()));
  const dueDate = new Date(String(body.dueDate || billDate.toISOString()));
  const amountCents = qty * unitCostCents;
  const bill = await prisma.vendorBill.create({
    data: {
      shopId,
      vendorId,
      billDate,
      dueDate,
      memo: String(body.memo || ''),
      lines: {
        create: [{
          inventoryItemId,
          description: String(body.description || 'Parts'),
          qty,
          unitCostCents,
          amountCents,
        }],
      },
    },
  });
  if (inventoryItemId) {
    const item = await prisma.inventoryItem.findFirst({ where: { id: inventoryItemId, shopId } });
    if (item) {
      const received = receiveInventory({
        onHand: item.quantity,
        unitCostCents: item.costCents,
        qty,
        billUnitCostCents: unitCostCents,
      });
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { quantity: received.qty, costCents: received.unitCostCents },
      });
      await prisma.inventoryValueSnapshot.create({
        data: {
          shopId,
          itemId: item.id,
          asOf: billDate,
          qty: received.qty,
          unitCostCents: received.unitCostCents,
          valueCents: received.valueCents,
        },
      });
    }
  }
  await saveJournalDraft(shopId, auth.id, postVendorBill({
    id: bill.id,
    date: billDate.toISOString().slice(0, 10),
    amountCents,
    toInventory: Boolean(inventoryItemId),
  }));
  if (body.payNow === true) {
    const payment = await prisma.billPayment.create({
      data: { billId: bill.id, shopId, amountCents, paidAt: billDate, method: 'check' },
    });
    await saveJournalDraft(shopId, auth.id, postBillPayment({
      id: payment.id,
      date: billDate.toISOString().slice(0, 10),
      amountCents,
    }));
  }
  return NextResponse.json({ ok: true, id: bill.id, amountCents }, { status: 201 });
}
