import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { booksAccess, shopIdForBooks } from '@/lib/books/access';
import { loadShopFacts, shopTimeZone } from '@/lib/books/loadTruth';
import { shopDateSpan } from '@/lib/books/periods';
import { cashBasisIncome, bankDepositEvents, buildShopStatement, periodCogsCents } from '@/lib/books/statements';
import { closedPayrollGrossCents, inventoryOnHandValueCents, partsCostFromUsage } from '@/lib/books/floor';
import { usdToCents } from '@/lib/books/money';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'accountant']);
  if (auth instanceof NextResponse) return auth;
  if (!booksAccess(auth.role).shopRevenue) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'Choose from and to dates' }, { status: 400 });
  }
  const zone = await shopTimeZone(shopId);
  const span = shopDateSpan(from, to, zone);
  const facts = await loadShopFacts(shopId);
  const [stock, orders, punches, bills, billPays, bankRows, taxRows] = await Promise.all([
    prisma.inventoryStock.findMany({ where: { shopId }, select: { id: true, sku: true, quantity: true, unitCost: true } }).catch(() => []),
    prisma.workOrder.findMany({
      where: { shopId },
      select: { id: true, status: true, completedAt: true, partsUsed: true, createdAt: true },
    }).catch(() => []),
    prisma.timeEntry.findMany({
      where: { shopId, clockOut: { not: null } },
      select: { id: true, techId: true, clockOut: true, hoursWorked: true, tech: { select: { hourlyRate: true } } },
    }).catch(() => []),
    prisma.vendorBill.findMany({
      where: { shopId },
      select: { id: true, billDate: true, lines: { select: { amountCents: true, inventoryItemId: true } } },
    }).catch(() => []),
    prisma.billPayment.findMany({
      where: { shopId },
      select: { id: true, paidAt: true, amountCents: true },
    }).catch(() => []),
    prisma.bankDeposit.findMany({
      where: { shopId },
      select: { id: true, depositedAt: true, amountCents: true },
    }).catch(() => []),
    prisma.journalEntry.findMany({
      where: { shopId, sourceType: 'sales_tax' },
      select: {
        id: true,
        entryDate: true,
        lines: { select: { accountKey: true, creditCents: true, workOrderId: true } },
      },
    }).catch(() => []),
  ]);
  const catalog = stock.map((item) => ({ id: item.id, sku: item.sku, costCents: usdToCents(item.unitCost) }));
  const partsCost = orders
    .filter((order) => order.status === 'completed' || order.status === 'closed')
    .map((order) => ({
      id: `cogs:${order.id}`,
      workOrderId: order.id,
      at: (order.completedAt || order.createdAt).toISOString(),
      cents: partsCostFromUsage({ partsUsed: order.partsUsed, catalog }),
    }))
    .filter((row) => row.cents > 0);
  const payroll = punches
    .filter((row) => row.clockOut)
    .map((row) => ({
      id: `payroll:${row.id}`,
      personId: row.techId,
      at: row.clockOut ? row.clockOut.toISOString() : to,
      cents: closedPayrollGrossCents([{ clockOut: row.clockOut, hoursWorked: row.hoursWorked, hourlyRate: row.tech.hourlyRate }]),
    }))
    .filter((row) => row.cents > 0);
  const billLines = bills.map((bill) => ({
    id: bill.id,
    at: bill.billDate.toISOString(),
    cents: bill.lines.reduce((sum, line) => sum + line.amountCents, 0),
    toInventory: bill.lines.some((line) => Boolean(line.inventoryItemId)),
  }));
  const bankDeposits = bankRows.length > 0
    ? bankRows.map((row) => ({ id: row.id, at: row.depositedAt.toISOString(), cents: row.amountCents }))
    : bankDepositEvents(facts);
  const collectedTax = taxRows.map((entry) => ({
    id: entry.id,
    workOrderId: entry.lines.find((line) => line.workOrderId)?.workOrderId || entry.id,
    at: entry.entryDate.toISOString(),
    cents: entry.lines
      .filter((line) => line.accountKey === 'salesTaxPayable')
      .reduce((sum, line) => sum + line.creditCents, 0),
  })).filter((row) => row.cents > 0);
  const statement = buildShopStatement({
    jobs: facts,
    timeZone: zone,
    from: span.start,
    to: span.end,
    partsCost,
    payroll,
    bills: billLines,
    billPayments: billPays.map((row) => ({ id: row.id, at: row.paidAt.toISOString(), cents: row.amountCents })),
    bankDeposits,
    collectedTax,
    inventoryValueCents: inventoryOnHandValueCents(stock.map((item) => ({
      quantity: item.quantity,
      unitCostCents: usdToCents(item.unitCost),
    }))),
  });
  const books = statement.books;
  const periodCogs = periodCogsCents(partsCost, span.start, span.end, zone);
  const periodPayroll = payroll.reduce((sum, row) => {
    const at = new Date(row.at);
    return at >= span.start && at < span.end ? sum + row.cents : sum;
  }, 0);
  const cash = cashBasisIncome({
    revenueCents: books.revenueCents,
    cogsCents: periodCogs,
    payrollCents: periodPayroll,
    shopSuppliesCents: statement.period.shopSuppliesCents,
  });
  const sheet = statement.sheet;
  const balance = statement.trial;
  return NextResponse.json({
    from,
    to,
    timeZone: zone,
    basis: cash.basis,
    basisNote: cash.note,
    books: {
      invoicedCents: books.invoicedCents,
      paidCents: books.paidCents,
      revenueCents: books.revenueCents,
      arCents: books.arCents,
      customerCreditCents: books.customerCreditCents,
    },
    profitAndLoss: {
      basis: 'accrual',
      revenueCents: cash.revenueCents,
      cogsCents: periodCogs,
      payrollCents: periodPayroll,
      shopSuppliesCents: statement.period.shopSuppliesCents,
      salesTaxCents: statement.asOf.salesTaxCents,
      arCents: statement.arCents,
      customerCreditCents: statement.customerCreditCents,
      cashNetIncomeCents: cash.netIncomeCents,
      netIncomeCents: statement.asOf.retainedEarningsCents,
      retainedEarningsCents: statement.asOf.retainedEarningsCents,
      accrualInvoicedCents: statement.asOf.laborIncomeCents + statement.asOf.partsIncomeCents + statement.asOf.subletIncomeCents,
      accrualNetIncomeCents: statement.asOf.retainedEarningsCents,
      note: 'Cash revenue matches Books. Net income is retained earnings on the balance sheet. The FixTray fee is not included.',
    },
    balanceSheet: sheet,
    balanceSheetBalances: sheet.balanced,
    trialBalance: balance,
    readOnly: booksAccess(auth.role).accountantRead,
  });
}
